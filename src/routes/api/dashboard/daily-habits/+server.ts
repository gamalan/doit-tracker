import { json } from '@sveltejs/kit';
import { getUserHabits, getCurrentDateYYYYMMDD, getDailyHabitMomentumForDate, formatDateYYYYMMDD } from '$lib/habits';
import { getDb } from '$lib/db/client';
import { habitRecords } from '$lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

export const GET = async ({ locals }) => {
  const session = await locals.auth();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    return new Response('User ID not found', { status: 400 });
  }
  
  // Get daily habits for the user
  const dailyHabits = await getUserHabits(userId, 'daily');
  
  // Current date for daily habit tracking
  const today = getCurrentDateYYYYMMDD();
  
  // Calculate date for 7 days ago to get all recent records
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = formatDateYYYYMMDD(sevenDaysAgo);
  
  console.log(`Getting daily habits from ${sevenDaysAgoStr} to ${today}`);
  
  // Early return if no habits
  if (dailyHabits.length === 0) {
    return json({
      dailyHabits: []
    });
  }
  
  const db = getDb();
  
  // Get all habit IDs for batch queries
  const habitIds = dailyHabits.map(habit => habit.id);
  
  // Import the inArray operator
  const { inArray } = await import('drizzle-orm');
  
  // Batch fetch all habit records for today in a single query using proper inArray
  const allTodayRecords = habitIds.length > 0 
    ? await db
        .select()
        .from(habitRecords)
        .where(
          and(
            inArray(habitRecords.habitId, habitIds),
            eq(habitRecords.date, today)
          )
        )
    : [];
    
  // Also fetch all records for the past 7 days to have history for momentum calculation
  const allHistoryRecords = habitIds.length > 0
    ? await db
        .select()
        .from(habitRecords)
        .where(
          and(
            inArray(habitRecords.habitId, habitIds),
            gte(habitRecords.date, sevenDaysAgoStr),
            lte(habitRecords.date, today)
          )
        )
    : [];
  
  // Also fetch all records for the last 7 days to count total completions
  const allRecentRecords = allHistoryRecords.filter(record => record.completed > 0);
  
  console.log(`Found ${allRecentRecords.length} completed daily habit records in the last 7 days`);
  
  // Count completions by habit
  const completionsByHabit = {};
  habitIds.forEach(id => completionsByHabit[id] = 0);
  
  allRecentRecords.forEach(record => {
    completionsByHabit[record.habitId] = (completionsByHabit[record.habitId] || 0) + record.completed;
  });
  
  // Create a lookup map for faster access
  const todayRecordsByHabitId = {};
  allTodayRecords.forEach(record => {
    todayRecordsByHabitId[record.habitId] = record;
  });
  
  // Group history records by habit ID
  const historyByHabitId = {};
  habitIds.forEach(id => historyByHabitId[id] = []);
  
  allHistoryRecords.forEach(record => {
    if (!historyByHabitId[record.habitId]) {
      historyByHabitId[record.habitId] = [];
    }
    historyByHabitId[record.habitId].push(record);
  });
  
  // Process each habit with the pre-fetched data
  const habitsWithRecords = await Promise.all(
    dailyHabits.map(async (habit) => {
      // Get today's record from our pre-fetched data
      const todayRecord = todayRecordsByHabitId[habit.id];
      
      // Get momentum with the new helper that preserves streaks
      const currentMomentum = todayRecord?.momentum || await getDailyHabitMomentumForDate(
        habit.id,
        userId,
        today,
        todayRecord?.completed || 0
      );
      
      // Get all habit history records to calculate accumulated momentum
      const habitHistory = historyByHabitId[habit.id] || [];
      
      // Calculate accumulated momentum by adding up all positive momentum values
      const accumulatedMomentum = habitHistory
        .filter(record => record.momentum > 0)
        .reduce((sum, record) => sum + record.momentum, 0);
      
      // Important: Count a habit as completed if it has positive momentum (preserving streaks)
      const isEffectivelyCompleted = todayRecord?.completed > 0 || currentMomentum > 0;
      
      // Get total completions in the last 7 days
      const totalCompletions = completionsByHabit[habit.id] || 0;
      console.log(`Daily habit "${habit.name}" has ${totalCompletions} total completions in the last 7 days, currentMomentum=${currentMomentum}, accumulatedMomentum=${accumulatedMomentum}, effectively completed: ${isEffectivelyCompleted}`);
      
      return {
        ...habit,
        todayRecord: todayRecord || null,
        currentMomentum,
        accumulatedMomentum,
        isEffectivelyCompleted,
        totalCompletions
      };
    })
  );
  
  // Calculate the total number of completions across all habits
  const totalDailyCompletions = Object.values(completionsByHabit).reduce((sum, count) => sum + (count as number), 0);
  console.log(`Total daily completions across all habits: ${totalDailyCompletions}`);
  
  return json({
    dailyHabits: habitsWithRecords,
    totalCompletions: totalDailyCompletions
  });
};