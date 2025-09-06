import { getDb } from '../db/client';
import { habits, habitRecords } from '../db/schema';
import { eq, and, sql, lt, gte, lte, desc } from 'drizzle-orm';
import { formatDateYYYYMMDD, createOrUpdateHabitRecord, getDateRangeForWeek, calculateWeeklyHabitMomentum } from '../habits';

/**
 * Process all daily habits that were missed yesterday
 * This function runs via cron job and applies penalties for missing days
 */
export async function processDailyMissedHabits(): Promise<{ processed: number; errors: number }> {
  const db = getDb();
  let processed = 0;
  let errors = 0;
  
  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateYYYYMMDD(yesterday);
    
    console.log(`Processing missed daily habits for ${yesterdayStr}`);
    
    // Get all active daily habits
    const dailyHabits = await db
      .select({
        habitId: habits.id,
        userId: habits.userId,
        habitName: habits.name
      })
      .from(habits)
      .where(
        and(
          eq(habits.type, 'daily'),
          sql`${habits.archivedAt} IS NULL`
        )
      );
    
    console.log(`Found ${dailyHabits.length} active daily habits to check`);
    
    // Check each habit for missing records
    for (const habit of dailyHabits) {
      try {
        // Check if there's already a record for yesterday
        const existingRecord = await db
          .select()
          .from(habitRecords)
          .where(
            and(
              eq(habitRecords.habitId, habit.habitId),
              eq(habitRecords.date, yesterdayStr)
            )
          )
          .limit(1);
        
        if (existingRecord.length === 0) {
          // No record exists for yesterday - this is a missed day
          console.log(`Missed daily habit: ${habit.habitName} (${habit.habitId}) for user ${habit.userId}`);
          
          // Calculate appropriate momentum penalty based on previous record
          let momentumPenalty = 0;
          
          // Get the most recent record before yesterday to determine penalty
          const previousRecord = await db
            .select()
            .from(habitRecords)
            .where(
              and(
                eq(habitRecords.habitId, habit.habitId),
                lt(habitRecords.date, yesterdayStr)
              )
            )
            .orderBy(desc(habitRecords.date))
            .limit(1);
          
          const lastRecord = previousRecord[0];
          
          if (lastRecord) {
            const previousMomentum = lastRecord.momentum || 0;
            
            if (previousMomentum > 0) {
              // Had positive momentum - first miss resets to 0
              momentumPenalty = 0;
              console.log(`Resetting positive momentum ${previousMomentum} to 0 for first missed day`);
            } else {
              // Already had zero or negative momentum - decrease by 1 (consecutive miss)
              momentumPenalty = Math.max(previousMomentum - 1, -3); // Cap at -3
              console.log(`Decreasing negative momentum from ${previousMomentum} to ${momentumPenalty} for consecutive miss`);
            }
          } else {
            // No previous record - check if this is part of consecutive missed days
            // Look for any missed day records created by cron job
            const missedDayRecords = await db
              .select()
              .from(habitRecords)
              .where(
                and(
                  eq(habitRecords.habitId, habit.habitId),
                  eq(habitRecords.completed, 0),
                  lt(habitRecords.date, yesterdayStr)
                )
              )
              .orderBy(desc(habitRecords.date))
              .limit(1);
            
            const lastMissedRecord = missedDayRecords[0];
            
            if (lastMissedRecord) {
              // There was a previous missed day - continue the negative momentum
              momentumPenalty = Math.max((lastMissedRecord.momentum || 0) - 1, -3);
              console.log(`Continuing negative momentum from ${lastMissedRecord.momentum || 0} to ${momentumPenalty} for consecutive missed day`);
            } else {
              // Truly no previous records at all - start with 0 for first miss
              momentumPenalty = 0;
              console.log(`No previous record found, setting momentum to 0 for first missed day`);
            }
          }
          
          // Create a record with calculated momentum penalty
          await createOrUpdateHabitRecord({
            habitId: habit.habitId,
            userId: habit.userId,
            date: yesterdayStr,
            completed: 0,
            momentum: momentumPenalty
          });
          
          processed++;
          console.log(`Applied penalty for missed habit: ${habit.habitName}, momentum: ${momentumPenalty}`);
        }
      } catch (error) {
        console.error(`Error processing habit ${habit.habitId}:`, error);
        errors++;
      }
    }
    
    console.log(`Daily missed habits processing complete. Processed: ${processed}, Errors: ${errors}`);
    return { processed, errors };
    
  } catch (error) {
    console.error('Error in processDailyMissedHabits:', error);
    throw error;
  }
}

/**
 * Process all weekly habits for completed weeks
 * This function runs via cron job and applies penalties for missing weekly targets
 * Should be run on Monday to process the previous week (Sunday ended)
 */
export async function processWeeklyMissedHabits(): Promise<{ processed: number; errors: number }> {
  const db = getDb();
  let processed = 0;
  let errors = 0;
  
  try {
    // Get the previous week's date range (the week that just ended)
    const today = new Date();
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - today.getDay()); // Go back to last Sunday
    if (today.getDay() !== 1) { // If it's not Monday, adjust
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7); // Go back one more week
    }
    
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6); // Monday of last week
    
    const weekStart = formatDateYYYYMMDD(lastWeekStart);
    const weekEnd = formatDateYYYYMMDD(lastWeekEnd);
    
    console.log(`Processing weekly habits for completed week: ${weekStart} to ${weekEnd}`);
    
    // Get all active weekly habits
    const weeklyHabits = await db
      .select({
        habitId: habits.id,
        userId: habits.userId,
        habitName: habits.name,
        targetCount: habits.targetCount
      })
      .from(habits)
      .where(
        and(
          eq(habits.type, 'weekly'),
          sql`${habits.archivedAt} IS NULL`
        )
      );
    
    console.log(`Found ${weeklyHabits.length} active weekly habits to check`);
    
    // Process each weekly habit
    for (const habit of weeklyHabits) {
      try {
        // Check if there are any records for the completed week
        const weekRecords = await db
          .select()
          .from(habitRecords)
          .where(
            and(
              eq(habitRecords.habitId, habit.habitId),
              gte(habitRecords.date, weekStart),
              lte(habitRecords.date, weekEnd)
            )
          );
        
        // Count total completions for the week
        const totalCompletions = weekRecords.reduce((sum, record) => sum + record.completed, 0);
        const targetMet = totalCompletions >= (habit.targetCount || 2);
        
        console.log(`Weekly habit: ${habit.habitName} had ${totalCompletions}/${habit.targetCount || 2} completions, target met: ${targetMet}`);
        
        if (!targetMet) {
          // Target was not met - need to apply penalty
          // Calculate the appropriate momentum for this missed week
          const habitData = {
            id: habit.habitId,
            name: habit.habitName,
            targetCount: habit.targetCount || 2,
            createdAt: null,
            userId: habit.userId,
            description: null,
            type: 'weekly' as const,
            accumulatedMomentum: null,
            archivedAt: null
          };
          
          const newMomentum = await calculateWeeklyHabitMomentum(
            habitData,
            habit.userId,
            weekStart,
            weekEnd
          );
          
          // Create a record on the last day of the week (Sunday) to represent the week's result
          await createOrUpdateHabitRecord({
            habitId: habit.habitId,
            userId: habit.userId,
            date: weekEnd,
            completed: 0,
            momentum: newMomentum
          });
          
          processed++;
          console.log(`Applied penalty for missed weekly target: ${habit.habitName}, momentum: ${newMomentum}`);
        } else {
          console.log(`Weekly habit ${habit.habitName} met target, no penalty needed`);
        }
        
      } catch (error) {
        console.error(`Error processing weekly habit ${habit.habitId}:`, error);
        errors++;
      }
    }
    
    console.log(`Weekly missed habits processing complete. Processed: ${processed}, Errors: ${errors}`);
    return { processed, errors };
    
  } catch (error) {
    console.error('Error in processWeeklyMissedHabits:', error);
    throw error;
  }
}

/**
 * Clean up old habit records (optional maintenance function)
 * Removes records older than specified days to keep database size manageable
 */
export async function cleanupOldRecords(daysToKeep: number = 365): Promise<number> {
  const db = getDb();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = formatDateYYYYMMDD(cutoffDate);
    
    console.log(`Cleaning up habit records older than ${cutoffStr}`);
    
    await db
      .delete(habitRecords)
      .where(lt(habitRecords.date, cutoffStr));
    
    console.log(`Cleaned up old habit records`);
    return 0; // Drizzle doesn't return affected rows count in all cases
    
  } catch (error) {
    console.error('Error cleaning up old records:', error);
    throw error;
  }
}