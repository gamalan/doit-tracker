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
  
  console.log(`Getting momentum history for habit ${habitId} from ${sevenDaysAgo} to ${today}`);
  
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
    
  console.log(`Found ${records.length} records for habit ${habitId}`);
  
  // Create a full 7-day dataset with missing days as null momentum
  const momentumHistory: { date: string; momentum: number | null }[] = [];
  const dateMap = new Map(records.map(record => [record.date, record.momentum]));
  
  // Fill in dates for the last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const momentum = dateMap.has(dateStr) ? dateMap.get(dateStr) : null;
    console.log(`Date ${dateStr} has momentum: ${momentum}`);
    
    momentumHistory.push({
      date: dateStr,
      momentum: momentum
    });
  }
  
  return momentumHistory;
}

// Load the daily habits for the logged in user
export const load: PageServerLoad = async ({ locals, depends }) => {
  // Mark data dependencies explicitly with more specific tags
  depends('daily-habits');
  depends('app:habits');
  
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
  console.log(`[Daily Habits] Loaded ${dailyHabits.length} daily habits for user ${userId}`);
  
  // Current date for daily habit tracking - ensure proper format
  const today = getCurrentDateYYYYMMDD();
  console.log(`[Daily Habits] Current date: ${today}`);
  
  // Early return if no habits
  if (dailyHabits.length === 0) {
    return {
      habits: []
    };
  }
  
  const db = getDb();
  
  // Get all habit IDs for batch queries
  const habitIds = dailyHabits.map(habit => habit.id);
  
  // Force clean dates in the database objects
  dailyHabits.forEach(habit => {
    // Convert dates to strings for serialization
    if (habit.createdAt) {
      habit.createdAt = new Date(habit.createdAt);
    }
    if (habit.archivedAt) {
      habit.archivedAt = new Date(habit.archivedAt);
    }
  });
  
  console.log(`[Daily Habits] Fetching today's records for ${habitIds.length} habits for date ${today}`);
  
  // Import the inArray operator
  const { inArray } = await import('drizzle-orm');
  
  // Use proper DrizzleORM inArray operator for multiple habit IDs
  const allTodayRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        inArray(habitRecords.habitId, habitIds),
        eq(habitRecords.date, today)
      )
    );
  
  console.log(`[Daily Habits] Found ${allTodayRecords.length} records for today (${today})`);
  
  // Add more detailed debug info to identify the issue
  console.log('[Daily Habits] Query execution details:');
  console.log(`Date filter: ${today}`);
  console.log(`Habit IDs: ${habitIds.join(', ')}`);
  
  // Debug output of all today's records for verification
  allTodayRecords.forEach(record => {
    console.log(`[Daily Habits] Today's record: habitId=${record.habitId}, date=${record.date}, completed=${record.completed}, momentum=${record.momentum}`);
  });
  
  // Create a lookup map for faster access - ensuring correct record mapping
  const todayRecordsByHabitId = {};
  allTodayRecords.forEach(record => {
    // Make a clean copy of the record to avoid reference issues
    const cleanRecord = {
      id: record.id,
      habitId: record.habitId,
      userId: record.userId,
      date: record.date ? record.date.split('T')[0] : record.date,
      completed: record.completed,
      momentum: record.momentum,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
    
    console.log(`[Daily Habits] Mapped record for habit ${cleanRecord.habitId}: completed=${cleanRecord.completed}, momentum=${cleanRecord.momentum}`);
    todayRecordsByHabitId[cleanRecord.habitId] = cleanRecord;
  });
  
  // Get momentum history records for all habits in a single query
  // For last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today and the past 6 days
  const sevenDaysAgoStr = formatDateYYYYMMDD(sevenDaysAgo);
  
  console.log(`[Daily Habits] Fetching 7-day history from ${sevenDaysAgoStr} to ${today}`);
  
  // Use proper DrizzleORM inArray operator for momentum history records
  const allMomentumHistoryRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        inArray(habitRecords.habitId, habitIds),
        gte(habitRecords.date, sevenDaysAgoStr),
        lte(habitRecords.date, today)
      )
    )
    .orderBy(habitRecords.date);
  
  console.log(`[Daily Habits] Found ${allMomentumHistoryRecords.length} history records for all habits`);
  console.log(`[Daily Habits] Date range: ${sevenDaysAgoStr} to ${today}`);
  
  // Group momentum history by habit ID
  const momentumHistoryByHabitId = {};
  
  // Initialize with empty arrays
  habitIds.forEach(id => {
    momentumHistoryByHabitId[id] = [];
  });
  
  // Populate momentum history by habit ID
  allMomentumHistoryRecords.forEach(record => {
    if (momentumHistoryByHabitId[record.habitId]) {
      momentumHistoryByHabitId[record.habitId].push({
        ...record,
        // Ensure date is properly formatted as YYYY-MM-DD
        date: record.date ? record.date.split('T')[0] : record.date
      });
    }
  });
  
  // Process each habit with the pre-fetched data
  const habitsWithRecords = await Promise.all(
    dailyHabits.map(async (habit) => {
      // Get today's record from our pre-fetched data
      const todayRecord = todayRecordsByHabitId[habit.id];
      
      console.log(`[Daily Habits] Processing habit "${habit.name}": ${todayRecord ? 'has record for today' : 'no record for today'}`);
      
      // Fix momentum calculation for new days:
      // If there's no record for today, we should preserve momentum from previous day
      // rather than resetting it to 0
      let currentMomentum;
      
      // Get momentum history from our pre-fetched data
      const habitMomentumHistory = momentumHistoryByHabitId[habit.id] || [];
      
      // Use the habit's stored accumulated momentum instead of calculating it each time
      const accumulatedMomentum = habit.accumulatedMomentum || 0;
      
      // For habits with no records today but with streaks from yesterday,
      // we want to preserve the streak but avoid double-counting
      if (!todayRecord) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = formatDateYYYYMMDD(yesterday);
        
        const previousDayRecord = habitMomentumHistory.find(r => r.date === yesterdayFormatted);
        
        if (previousDayRecord && previousDayRecord.completed > 0 && previousDayRecord.momentum > 0) {
          // Preserve momentum from previous day streak
          currentMomentum = previousDayRecord.momentum;
        } else {
          // Calculate using standard method
          currentMomentum = await calculateDailyHabitMomentum(
            habit.id,
            userId,
            today,
            0
          );
        }
      } else {
        // Use the existing momentum from today's record
        currentMomentum = todayRecord.momentum;
      }
      
      console.log(`[Daily Habits] Current momentum for "${habit.name}": ${currentMomentum}, Accumulated momentum: ${accumulatedMomentum}`);
      
      // Process momentum history to ensure we have exactly 7 data points
      const dates = generateDateRangeArray(sevenDaysAgo, new Date());
      const momentumHistory = dates.map(date => {
        const dateStr = formatDateYYYYMMDD(date);
        const record = habitMomentumHistory.find(r => r.date === dateStr);
        
        const momentum = record?.momentum ?? null;
        console.log(`[Daily Habits] "${habit.name}" history for ${dateStr}: ${momentum}`);
        
        return {
          date: dateStr,
          momentum: momentum
        };
      });
      
      return {
        ...habit,
        todayRecord: todayRecord || null,
        currentMomentum,
        accumulatedMomentum,
        momentumHistory
      };
    })
  );
  
  console.log(`[Daily Habits] Returning ${habitsWithRecords.length} habits with data`);
  
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
    
    console.log(`[TRACK] Tracking habit ${habitId}, completed=${completed}`);
    
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
      console.log(`[TRACK] Today's date: ${today}`);
      
      // First get the existing record to log it
      const existingRecord = await getHabitRecordForDate(habitId, today);
      console.log(`[TRACK] Existing record:`, existingRecord);
      
      // Use createOrUpdateHabitRecord directly, which now contains the proper punishment logic
      // The momentum will be calculated internally based on the habit's tracking history
      const updatedRecord = await createOrUpdateHabitRecord({
        habitId,
        userId: session.user.id,
        date: today,
        completed
      });
      
      console.log(`[TRACK] Updated record:`, updatedRecord);
      
      // Return the updated momentum from the record
      return { 
        success: true, 
        momentum: updatedRecord.momentum,
        completed,
        updatedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('[TRACK] Error tracking habit:', err);
      return { success: false, error: 'Failed to track habit' };
    }
  }
};