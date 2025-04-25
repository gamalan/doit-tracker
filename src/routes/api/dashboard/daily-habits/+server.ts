import { json } from '@sveltejs/kit';
import { getUserHabits, getCurrentDateYYYYMMDD, calculateDailyHabitMomentum } from '$lib/habits';
import { getDb } from '$lib/db/client';
import { habitRecords } from '$lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

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
  
  // Early return if no habits
  if (dailyHabits.length === 0) {
    return json({
      dailyHabits: []
    });
  }
  
  const db = getDb();
  
  // Get all habit IDs for batch queries
  const habitIds = dailyHabits.map(habit => habit.id);
  
  // Batch fetch all habit records for today in a single query
  const allTodayRecords = habitIds.length > 0 
    ? await db
        .select()
        .from(habitRecords)
        .where(
          and(
            sql`${habitRecords.habitId} IN (${habitIds.join(',')})`,
            eq(habitRecords.date, today)
          )
        )
    : [];
  
  // Create a lookup map for faster access
  const todayRecordsByHabitId = {};
  allTodayRecords.forEach(record => {
    todayRecordsByHabitId[record.habitId] = record;
  });
  
  // Process each habit with the pre-fetched data
  const habitsWithRecords = await Promise.all(
    dailyHabits.map(async (habit) => {
      // Get today's record from our pre-fetched data
      const todayRecord = todayRecordsByHabitId[habit.id];
      
      // Get momentum from record or calculate if needed
      const currentMomentum = todayRecord?.momentum || await calculateDailyHabitMomentum(
        habit.id,
        userId,
        today,
        todayRecord?.completed || 0
      );
      
      return {
        ...habit,
        todayRecord: todayRecord || null,
        currentMomentum
      };
    })
  );
  
  return json({
    dailyHabits: habitsWithRecords
  });
};