import { redirect, error, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserHabits, createHabit, getHabitById, archiveHabit, getDateRangeForWeek, createOrUpdateHabitRecord, calculateWeeklyHabitMomentum, getHabitRecordForDate, formatDateYYYYMMDD } from '$lib/habits';
import { getDb } from '$lib/db/client';
import { habitRecords } from '$lib/db/schema';
import { and, eq, gte, lte, sql, lt } from 'drizzle-orm';
import { getUserById } from '$lib/db/user';

// Debug function to help troubleshoot user ID issues
function logDebug(phase: string, data: any) {
  console.log(`[WEEKLY DEBUG] ${phase}:`, JSON.stringify(data, null, 2));
}

// Load the weekly habits for the logged in user
export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();
  
  if (!session) {
    throw redirect(303, '/login');
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    throw error(401, 'User ID not found in session');
  }
  
  // Get all weekly habits for the user
  const weeklyHabits = await getUserHabits(userId, 'weekly');
  
  // Get current week's date range
  const currentWeek = getDateRangeForWeek();
  
  const db = getDb();
  
  // For each habit, get this week's records and calculate current momentum
  const habitsWithRecords = await Promise.all(
    weeklyHabits.map(async (habit) => {
      // Get all records for this habit in the current week
      const records = await db
        .select()
        .from(habitRecords)
        .where(
          and(
            eq(habitRecords.habitId, habit.id),
            gte(habitRecords.date, currentWeek.start),
            lte(habitRecords.date, currentWeek.end)
          )
        );
      
      // Count completions
      const completions = records.reduce((sum, record) => sum + record.completed, 0);
      
      // Find the latest record (for momentum)
      const latestRecord = records.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0] || null;
      
      // Calculate fresh momentum for display
      const currentMomentum = await calculateWeeklyHabitMomentum(
        habit,
        userId,
        currentWeek.start,
        currentWeek.end
      );

      // Get momentum history for past 8 weeks
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56); // 8 weeks * 7 days
      
      // Get the most recent records for the last 8 weeks
      const momentumHistoryRecords = await db
        .select()
        .from(habitRecords)
        .where(
          and(
            eq(habitRecords.habitId, habit.id),
            gte(habitRecords.date, formatDateYYYYMMDD(eightWeeksAgo)),
          )
        )
        .orderBy(habitRecords.date);
      
      // Group records by week to get a single data point per week
      const weeklyMomentumMap = new Map();
      
      momentumHistoryRecords.forEach(record => {
        // Get the start of the week for this record
        const recordDate = new Date(record.date);
        const weekStart = new Date(recordDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
        const weekKey = formatDateYYYYMMDD(weekStart);
        
        // Only keep the latest record for each week
        if (!weeklyMomentumMap.has(weekKey) || 
            new Date(record.date) > new Date(weeklyMomentumMap.get(weekKey).date)) {
          weeklyMomentumMap.set(weekKey, {
            date: record.date,
            momentum: record.momentum
          });
        }
      });
      
      // Convert the map to an array and sort by date
      let momentumHistory = Array.from(weeklyMomentumMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Ensure we have exactly 8 data points
      while (momentumHistory.length < 8) {
        // Add null momentum for missing weeks at the beginning
        const earliestDate = momentumHistory.length > 0 
          ? new Date(momentumHistory[0].date) 
          : new Date();
        
        const prevWeekDate = new Date(earliestDate);
        prevWeekDate.setDate(prevWeekDate.getDate() - 7);
        
        momentumHistory.unshift({
          date: formatDateYYYYMMDD(prevWeekDate),
          momentum: null
        });
      }
      
      // Trim to the last 8 weeks
      if (momentumHistory.length > 8) {
        momentumHistory = momentumHistory.slice(-8);
      }
      
      return {
        ...habit,
        weekRecords: records,
        completionsThisWeek: completions,
        targetMet: completions >= (habit.targetCount || 2),
        latestRecord,
        currentMomentum, // Add freshly calculated momentum
        momentumHistory, // Add the weekly momentum history
      };
    })
  );
  
  return {
    habits: habitsWithRecords,
    currentWeek
  };
};

export const actions: Actions = {
  // Create a new weekly habit
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
    const targetCount = parseInt(data.get('targetCount')?.toString() || '2', 10);
    
    if (!name) {
      return { success: false, error: 'Habit name is required' };
    }
    
    // Ensure the target count is at least 2
    const validTargetCount = Math.max(2, targetCount);
    
    try {
      
      const newHabit = await createHabit({
        userId: userInDb.id, // Use the verified database user ID
        name,
        description,
        type: 'weekly',
        targetCount: validTargetCount
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
  
  // Track a weekly habit (mark as complete for today)
  trackHabit: async ({ request, locals }) => {
    const session = await locals.auth();
    if (!session || !session.user?.id) {
      throw error(401, 'Unauthorized');
    }
    
    const data = await request.formData();
    const habitId = data.get('habitId')?.toString();
    const date = data.get('date')?.toString() || formatDateYYYYMMDD(new Date());
    
    if (!habitId) {
      return { success: false, error: 'Habit ID is required' };
    }
    
    try {
      // Verify that this habit belongs to the user
      const habit = await getHabitById(habitId);
      if (!habit || habit.userId !== session.user.id) {
        return { success: false, error: 'Habit not found or access denied' };
      }
      
      // Check if a record already exists for this date
      const existingRecord = await getHabitRecordForDate(habitId, date);
      
      // If record already exists and completed, we're toggling off
      const completed = existingRecord?.completed ? 0 : 1;
      
      // Get current week date range for the selected date
      const currentWeek = getDateRangeForWeek(new Date(date));
      
      // Calculate momentum based on all completions in the week
      const momentum = await calculateWeeklyHabitMomentum(
        habit,
        session.user.id,
        currentWeek.start,
        currentWeek.end
      );
      
      // Log calculated momentum for debugging
      console.log(`Calculated momentum for habit ${habit.name}: ${momentum}`);
      
      // Create or update the record for this date
      await createOrUpdateHabitRecord({
        habitId,
        userId: session.user.id,
        date,
        completed,
        momentum
      });
      
      // For weekly habits, we need to update ALL records for this week with the new momentum
      // This ensures consistency in momentum across the week
      const db = getDb();
      
      // Update all records for this habit in the current week
      await db
        .update(habitRecords)
        .set({ momentum })
        .where(
          and(
            eq(habitRecords.habitId, habitId),
            gte(habitRecords.date, currentWeek.start),
            lte(habitRecords.date, currentWeek.end)
          )
        );
      
      return { success: true, completed, momentum };
    } catch (err) {
      console.error('Error tracking habit:', err);
      return { success: false, error: 'Failed to track habit' };
    }
  }
};