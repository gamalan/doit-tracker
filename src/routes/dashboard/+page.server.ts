import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserHabits, getUserTotalMomentum, getCurrentDateYYYYMMDD, getHabitRecordForDate, getDateRangeForWeek, calculateDailyHabitMomentum, calculateWeeklyHabitMomentum, getMomentumHistory } from '$lib/habits';
import { getDb } from '$lib/db/client';
import { habitRecords } from '$lib/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, depends }) => {
  // Mark data dependencies explicitly
  depends('dashboard-data');
  
  const session = await locals.auth();
  
  if (!session) {
    throw redirect(303, '/login');
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    throw error(401, 'User ID not found in session');
  }
  
  // Get user's total momentum score (this is already optimized)
  const totalMomentum = await getUserTotalMomentum(userId);
  
  // Get momentum history for the past 30 days (this is already optimized)
  const momentumHistory = await getMomentumHistory(userId, 30);
  
  // Get all habits in a single query instead of separate calls
  const allHabits = await getUserHabits(userId);
  
  // Split into daily and weekly habits
  const dailyHabits = allHabits.filter(h => h.type === 'daily');
  const weeklyHabits = allHabits.filter(h => h.type === 'weekly');
  
  // Early return if no habits
  if (dailyHabits.length === 0 && weeklyHabits.length === 0) {
    return {
      totalMomentum,
      dailyHabits: [],
      weeklyHabits: [],
      currentWeek: getDateRangeForWeek(),
      momentumHistory
    };
  }
  
  const db = getDb();
  const today = getCurrentDateYYYYMMDD();
  const currentWeek = getDateRangeForWeek();
  
  // Batch processing for daily habits
  const dailyHabitIds = dailyHabits.map(habit => habit.id);
  
  // Get all today's records for daily habits in one query
  const dailyRecords = dailyHabitIds.length > 0 
    ? await db
        .select()
        .from(habitRecords)
        .where(
          and(
            sql`${habitRecords.habitId} IN (${dailyHabitIds.join(',')})`,
            eq(habitRecords.date, today)
          )
        )
    : [];
  
  // Create a lookup map for faster access
  const dailyRecordsByHabitId = {};
  dailyRecords.forEach(record => {
    dailyRecordsByHabitId[record.habitId] = record;
  });
  
  // Process daily habits with the pre-fetched data
  const dailyHabitsWithRecords = await Promise.all(
    dailyHabits.map(async (habit) => {
      const record = dailyRecordsByHabitId[habit.id];
      
      // Only calculate momentum if needed (this is still an expensive operation)
      const completed = record?.completed || 0;
      const currentMomentum = record?.momentum || await calculateDailyHabitMomentum(
        habit.id,
        userId,
        today,
        completed
      );
      
      return {
        ...habit,
        todayRecord: record || null,
        currentMomentum
      };
    })
  );
  
  // Batch processing for weekly habits
  const weeklyHabitIds = weeklyHabits.map(habit => habit.id);
  
  // Get all records for the current week for all weekly habits in a single query
  const weeklyRecords = weeklyHabitIds.length > 0
    ? await db
        .select()
        .from(habitRecords)
        .where(
          and(
            sql`${habitRecords.habitId} IN (${weeklyHabitIds.join(',')})`,
            gte(habitRecords.date, currentWeek.start),
            lte(habitRecords.date, currentWeek.end)
          )
        )
    : [];
  
  // Group by habit ID for faster processing
  const weeklyRecordsByHabitId = {};
  weeklyHabitIds.forEach(id => {
    weeklyRecordsByHabitId[id] = [];
  });
  
  weeklyRecords.forEach(record => {
    if (weeklyRecordsByHabitId[record.habitId]) {
      weeklyRecordsByHabitId[record.habitId].push(record);
    }
  });
  
  // Process weekly habits with the pre-fetched data
  const weeklyHabitsWithRecords = await Promise.all(
    weeklyHabits.map(async (habit) => {
      const records = weeklyRecordsByHabitId[habit.id] || [];
      
      // Count completions
      const completions = records.reduce((sum, record) => sum + record.completed, 0);
      
      // Find the latest record (for momentum)
      const latestRecord = records.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0] || null;
      
      // Use the latest record's momentum if available, otherwise calculate
      const currentMomentum = latestRecord?.momentum || await calculateWeeklyHabitMomentum(
        habit,
        userId,
        currentWeek.start,
        currentWeek.end
      );
      
      return {
        ...habit,
        completionsThisWeek: completions,
        targetMet: completions >= (habit.targetCount || 2),
        latestRecord,
        currentMomentum
      };
    })
  );
  
  return {
    totalMomentum,
    dailyHabits: dailyHabitsWithRecords,
    weeklyHabits: weeklyHabitsWithRecords,
    currentWeek,
    momentumHistory
  };
};