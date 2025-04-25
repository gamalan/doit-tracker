import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserHabits, getUserTotalMomentum, getCurrentDateYYYYMMDD, getHabitRecordForDate, getDateRangeForWeek, calculateDailyHabitMomentum, calculateWeeklyHabitMomentum, getMomentumHistory } from '$lib/habits';
import { getDb } from '$lib/db/client';
import { habitRecords } from '$lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();
  
  if (!session) {
    throw redirect(303, '/login');
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    throw error(401, 'User ID not found in session');
  }
  
  // Get user's total momentum score
  const totalMomentum = await getUserTotalMomentum(userId);
  
  // Get daily habits
  const dailyHabits = await getUserHabits(userId, 'daily');
  
  // Get weekly habits
  const weeklyHabits = await getUserHabits(userId, 'weekly');
  
  // Get momentum history for the past 30 days
  const momentumHistory = await getMomentumHistory(userId, 30);
  
  // For daily habits, get today's records
  const today = getCurrentDateYYYYMMDD();
  const dailyHabitsWithRecords = await Promise.all(
    dailyHabits.map(async (habit) => {
      const record = await getHabitRecordForDate(habit.id, today);
      
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
        currentMomentum
      };
    })
  );
  
  // For weekly habits, get this week's records
  const db = getDb();
  const currentWeek = getDateRangeForWeek();
  
  const weeklyHabitsWithRecords = await Promise.all(
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