import { redirect, error, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserHabits, createHabit, getHabitById, archiveHabit, getCurrentDateYYYYMMDD, createOrUpdateHabitRecord, calculateDailyHabitMomentum, getHabitRecordForDate, formatDateYYYYMMDD } from '$lib/habits';
import { getUserById } from '$lib/db/user';
import { habitRecords } from '$lib/db/schema';
import { eq, and, lte, gte, sql } from 'drizzle-orm';
import { getDb } from '$lib/db/client';

// Function to get the date 7 days ago in YYYY-MM-DD format
function getDateSevenDaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 6); // -6 to include today (for a total of 7 days)
  return date.toISOString().split('T')[0];
}

// Get momentum history for a habit for the last 7 days
async function getMomentumHistory(habitId: string): Promise<any[]> {
  const db = getDb();
  const today = getCurrentDateYYYYMMDD();
  const sevenDaysAgo = getDateSevenDaysAgo();
  
  const records = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        eq(habitRecords.habitId, habitId),
        gte(habitRecords.date, sevenDaysAgo),
        lte(habitRecords.date, today)
      )
    );
    
  // Create a full 7-day dataset with missing days as null momentum
  const momentumHistory: { date: string; momentum: number | null }[] = [];
  const dateMap = new Map(records.map(record => [record.date, record.momentum]));
  
  // Fill in dates for the last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    momentumHistory.push({
      date: dateStr,
      momentum: dateMap.has(dateStr) ? dateMap.get(dateStr) : null
    });
  }
  
  return momentumHistory;
}

// Load the daily habits for the logged in user
export const load: PageServerLoad = async ({ locals, depends }) => {
  // Mark data dependencies explicitly
  depends('daily-habits');
  
  const session = await locals.auth();
  
  if (!session) {
    throw redirect(303, '/login');
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    throw error(401, 'User ID not found in session');
  }
  
  // Get all daily habits for the user
  const dailyHabits = await getUserHabits(userId, 'daily');
  
  // Current date for daily habit tracking
  const today = getCurrentDateYYYYMMDD();
  
  // Early return if no habits
  if (dailyHabits.length === 0) {
    return {
      habits: []
    };
  }
  
  const db = getDb();
  
  // Get all habit IDs for batch queries
  const habitIds = dailyHabits.map(habit => habit.id);
  
  // Batch fetch all habit records for today in a single query
  const allTodayRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        sql`${habitRecords.habitId} IN (${habitIds.join(',')})`,
        eq(habitRecords.date, today)
      )
    );
  
  // Create a lookup map for faster access
  const todayRecordsByHabitId = {};
  allTodayRecords.forEach(record => {
    todayRecordsByHabitId[record.habitId] = record;
  });
  
  // Get momentum history records for all habits in a single query
  // For last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = formatDateYYYYMMDD(sevenDaysAgo);
  
  const allMomentumHistoryRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        sql`${habitRecords.habitId} IN (${habitIds.join(',')})`,
        gte(habitRecords.date, sevenDaysAgoStr)
      )
    )
    .orderBy(habitRecords.date);
  
  // Group momentum history by habit ID
  const momentumHistoryByHabitId = {};
  
  // Initialize with empty arrays
  habitIds.forEach(id => {
    momentumHistoryByHabitId[id] = [];
  });
  
  // Populate momentum history by habit ID
  allMomentumHistoryRecords.forEach(record => {
    if (momentumHistoryByHabitId[record.habitId]) {
      momentumHistoryByHabitId[record.habitId].push(record);
    }
  });
  
  // Process each habit with the pre-fetched data
  const habitsWithRecords = await Promise.all(
    dailyHabits.map(async (habit) => {
      // Get today's record from our pre-fetched data
      const todayRecord = todayRecordsByHabitId[habit.id];
      
      // Calculate fresh momentum (this is still expensive but necessary for accuracy)
      const currentMomentum = todayRecord?.momentum || await calculateDailyHabitMomentum(
        habit.id,
        userId,
        today,
        todayRecord?.completed || 0
      );
      
      // Get momentum history from our pre-fetched data
      const habitMomentumHistory = momentumHistoryByHabitId[habit.id] || [];
      
      // Process momentum history to ensure we have exactly 7 data points
      const dates = generateDateRangeArray(sevenDaysAgo, new Date());
      const momentumHistory = dates.map(date => {
        const dateStr = formatDateYYYYMMDD(date);
        const record = habitMomentumHistory.find(r => r.date === dateStr);
        
        return {
          date: dateStr,
          momentum: record?.momentum || null
        };
      });
      
      return {
        ...habit,
        todayRecord: todayRecord || null,
        currentMomentum,
        momentumHistory
      };
    })
  );
  
  return {
    habits: habitsWithRecords
  };
};

// Helper function to generate an array of dates (inclusive range)
function generateDateRangeArray(startDate: Date, endDate: Date): Date[] {
  const dates = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

export const actions: Actions = {
  // Create a new daily habit
  createHabit: async ({ request, locals }) => {
    const session = await locals.auth();
    if (!session || !session.user?.id) {
      throw error(401, 'Unauthorized');
    }
    
    const userId = session.user.id;
    
    // Verify the user exists in the database before creating a habit
    const userInDb = await getUserById(userId);
    
    if (!userInDb) {
      return { success: false, error: 'User not found in database. Please try logging out and back in.' };
    }
    
    const data = await request.formData();
    const name = data.get('name')?.toString();
    const description = data.get('description')?.toString() || null;
    
    if (!name) {
      return { success: false, error: 'Habit name is required' };
    }
    
    try {
      
      const newHabit = await createHabit({
        userId: userInDb.id, // Use the verified database user ID
        name,
        description,
        type: 'daily',
        targetCount: 1 // Daily habits always have a target of 1
      });
      
      return { success: true, habitId: newHabit.id };
    } catch (err) {
      console.error('Error creating habit:', err);
      return { success: false, error: `Failed to create habit: ${err.message}` };
    }
  },
  
  // Archive (soft delete) a habit
  archiveHabit: async ({ request, locals }) => {
    const session = await locals.auth();
    if (!session || !session.user?.id) {
      throw error(401, 'Unauthorized');
    }
    
    const data = await request.formData();
    const habitId = data.get('habitId')?.toString();
    
    if (!habitId) {
      return { success: false, error: 'Habit ID is required' };
    }
    
    try {
      // Verify that this habit belongs to the user
      const habit = await getHabitById(habitId);
      if (!habit || habit.userId !== session.user.id) {
        return { success: false, error: 'Habit not found or access denied' };
      }
      
      await archiveHabit(habitId);
      return { success: true };
    } catch (err) {
      console.error('Error archiving habit:', err);
      return { success: false, error: 'Failed to archive habit' };
    }
  },
  
  // Track a daily habit (mark as complete/incomplete for today)
  trackHabit: async ({ request, locals }) => {
    const session = await locals.auth();
    if (!session || !session.user?.id) {
      throw error(401, 'Unauthorized');
    }
    
    const data = await request.formData();
    const habitId = data.get('habitId')?.toString();
    const completed = data.get('completed') === 'true' ? 1 : 0;
    
    if (!habitId) {
      return { success: false, error: 'Habit ID is required' };
    }
    
    try {
      // Verify that this habit belongs to the user
      const habit = await getHabitById(habitId);
      if (!habit || habit.userId !== session.user.id) {
        return { success: false, error: 'Habit not found or access denied' };
      }
      
      const today = getCurrentDateYYYYMMDD();
      
      // Calculate momentum based on completion status
      const momentum = await calculateDailyHabitMomentum(habitId, session.user.id, today, completed);
      
      // Create or update the record for today
      await createOrUpdateHabitRecord({
        habitId,
        userId: session.user.id,
        date: today,
        completed,
        momentum
      });
      
      return { success: true, momentum };
    } catch (err) {
      console.error('Error tracking habit:', err);
      return { success: false, error: 'Failed to track habit' };
    }
  }
};