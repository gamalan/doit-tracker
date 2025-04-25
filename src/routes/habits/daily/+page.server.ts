import { redirect, error, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserHabits, createHabit, getHabitById, archiveHabit, getCurrentDateYYYYMMDD, createOrUpdateHabitRecord, calculateDailyHabitMomentum, getHabitRecordForDate } from '$lib/habits';
import { getUserById } from '$lib/db/user';
import { habitRecords } from '$lib/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { getDb } from '$lib/db/client';

// Debug function to help troubleshoot user ID issues
function logDebug(phase: string, data: any) {
  console.log(`[DEBUG] ${phase}:`, JSON.stringify(data, null, 2));
}

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
export const load: PageServerLoad = async ({ locals }) => {
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
  
  // For each habit, get today's record if it exists
  const today = getCurrentDateYYYYMMDD();
  const habitsWithRecords = await Promise.all(
    dailyHabits.map(async (habit) => {
      const record = await getHabitRecordForDate(habit.id, today);
      const momentumHistory = await getMomentumHistory(habit.id);
      
      // Calculate fresh momentum for display
      const completed = record?.completed || 0;
      const currentMomentum = await calculateDailyHabitMomentum(
        habit.id,
        userId,
        today,
        completed
      );
      
      return {
        ...habit,
        todayRecord: record || null,
        momentumHistory,
        currentMomentum
      };
    })
  );
  
  return {
    habits: habitsWithRecords
  };
};

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