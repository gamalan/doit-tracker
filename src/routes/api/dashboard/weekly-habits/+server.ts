import { json } from '@sveltejs/kit';
import { getUserHabits, getDateRangeForWeek, calculateWeeklyHabitMomentum } from '$lib/habits';
import { getDb } from '$lib/db/client';
import { habitRecords } from '$lib/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

export const GET = async ({ locals }) => {
  const session = await locals.auth();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    return new Response('User ID not found', { status: 400 });
  }
  
  // Get all weekly habits for the user
  const weeklyHabits = await getUserHabits(userId, 'weekly');
  
  // Get current week's date range
  const currentWeek = getDateRangeForWeek();
  
  // Debug log
  console.log('Current week range:', currentWeek);
  
  // Early return if no habits
  if (weeklyHabits.length === 0) {
    return json({
      weeklyHabits: [],
      currentWeek
    });
  }
  
  const db = getDb();
  
  // Batch fetch all habit records for all habits in one query
  const habitIds = weeklyHabits.map(habit => habit.id);
  
  // Get all records for the current week for all habits in a single query
  const queriesRecord = db
  .select()
  .from(habitRecords)
  .where(
    and(
      sql`${habitRecords.habitId} IN (${habitIds.join(',')})`,
      gte(habitRecords.date, currentWeek.start),
      lte(habitRecords.date, currentWeek.end)
    )
  );
  const allWeekRecords = habitIds.length > 0
    ? await queriesRecord
    : [];
  
  console.log(`Query ${queriesRecord.toSQL().sql} returned ${allWeekRecords.length} records`);
  console.log(`Param ${queriesRecord.toSQL().params} returned ${allWeekRecords.length} records`);
  // Debug log to see what records we found
  console.log(`Found ${allWeekRecords.length} weekly habit records for ${habitIds.length} habits`);
  
  // Group by habit ID for faster processing
  const weeklyRecordsByHabitId = {};
  
  // Initialize with empty arrays
  habitIds.forEach(id => {
    weeklyRecordsByHabitId[id] = [];
  });
  
  // Populate records by habit ID
  allWeekRecords.forEach(record => {
    if (weeklyRecordsByHabitId[record.habitId]) {
      weeklyRecordsByHabitId[record.habitId].push(record);
    }
  });
  
  // Process each habit with the pre-fetched data
  const habitsWithRecords = await Promise.all(
    weeklyHabits.map(async (habit) => {
      const records = weeklyRecordsByHabitId[habit.id] || [];
      
      // Debug the records for this habit
      console.log(`Habit ID ${habit.id} (${habit.name}) has ${records.length} records:`, records);
      
      // Count completions - fix this to properly account for completed records
      // A record is considered "completed" when completed > 0
      const completions = records.reduce((sum, record) => sum + (record.completed > 0 ? 1 : 0), 0);
      
      console.log(`Habit ${habit.name} has ${completions} completions this week`);
      
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
      
      // Also set a flag directly to indicate if the habit has any records this week
      const hasRecordsThisWeek = records.length > 0;
      
      return {
        ...habit,
        completionsThisWeek: completions,
        targetMet: completions >= (habit.targetCount || 2),
        latestRecord,
        currentMomentum,
        hasRecordsThisWeek, // Add this flag to make it very clear if the habit has been tracked
        weekRecords: records // Include the full records for debugging if needed
      };
    })
  );
  
  // Debug the final result
  console.log('Weekly habits processed:', habitsWithRecords.map(h => ({
    id: h.id,
    name: h.name,
    completionsThisWeek: h.completionsThisWeek,
    hasRecordsThisWeek: h.hasRecordsThisWeek,
    targetMet: h.targetMet
  })));
  
  return json({
    weeklyHabits: habitsWithRecords,
    currentWeek
  });
};