import type { NewHabit } from './db/schema';
import { getDb } from './db/client';
import { habits, habitRecords, users } from './db/schema';
import { eq, and, sql, desc, gte, lte, lt } from 'drizzle-orm';

// Type definitions
export type Habit = typeof habits.$inferSelect;
export type HabitRecord = typeof habitRecords.$inferSelect;
export type NewHabitRecord = typeof habitRecords.$inferInsert;

// Date utilities
export function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getCurrentDateYYYYMMDD(): string {
  return formatDateYYYYMMDD(new Date());
}

export function getDateRangeForWeek(date: Date = new Date()): { start: string, end: string } {
  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = date.getDay();
  
  // Calculate the date of Monday (first day of the week)
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + (day === 0 ? -6 : 1)); // Adjust if date is Sunday
  
  // Calculate the date of Sunday (last day of the week)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: formatDateYYYYMMDD(monday),
    end: formatDateYYYYMMDD(sunday)
  };
}

// CRUD functions for habits
export async function createHabit(habitData: NewHabit): Promise<Habit> {
  const db = getDb();
  
  try {
    // First verify that the user exists before creating the habit
    const userExists = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(eq(users.id, habitData.userId));
    
    const userCount = Number(userExists[0]?.count || 0);
    if (userCount === 0) {
      throw new Error(`User with ID ${habitData.userId} does not exist in the database`);
    }
    
    const result = await db.insert(habits).values(habitData).returning();
    return result[0];
  } catch (error) {
    throw error;
  }
}

export async function getHabitById(id: string): Promise<Habit | undefined> {
  const db = getDb();
  const result = await db.select().from(habits).where(eq(habits.id, id)).limit(1);
  return result[0];
}

export async function getUserHabits(userId: string, type?: 'daily' | 'weekly'): Promise<Habit[]> {
  const db = getDb();
  
  // Properly build the query with all conditions
  let conditions = sql`${habits.archivedAt} IS NULL`;
  
  // Add user ID condition - this is critical
  conditions = sql`${conditions} AND ${habits.userId} = ${userId}`;
  
  // Add type condition if provided
  if (type) {
    conditions = sql`${conditions} AND ${habits.type} = ${type}`;
  }
  
  // Log the full SQL query for debugging
  const query = db.select().from(habits).where(conditions);
  const results = await query.orderBy(habits.createdAt);
  
  return results;
}

export async function archiveHabit(id: string): Promise<Habit | undefined> {
  const db = getDb();
  const now = new Date();
  const result = await db
    .update(habits)
    .set({ archivedAt: now })
    .where(eq(habits.id, id))
    .returning();
  return result[0];
}

// Tracking records functions
export async function getHabitRecordForDate(habitId: string, date: string): Promise<HabitRecord | undefined> {
  const db = getDb();
  const result = await db
    .select()
    .from(habitRecords)
    .where(and(eq(habitRecords.habitId, habitId), eq(habitRecords.date, date)))
    .limit(1);
  return result[0];
}

export async function createOrUpdateHabitRecord(
  recordData: NewHabitRecord
): Promise<HabitRecord> {
  const db = getDb();
  
  // Check if record already exists
  const existingRecord = await getHabitRecordForDate(recordData.habitId, recordData.date);
  
  if (existingRecord) {
    // Update existing record
    const result = await db
      .update(habitRecords)
      .set(recordData)
      .where(eq(habitRecords.id, existingRecord.id))
      .returning();
    return result[0];
  } else {
    // Create new record
    const result = await db
      .insert(habitRecords)
      .values(recordData)
      .returning();
    return result[0];
  }
}

// Momentum calculation functions
export async function calculateDailyHabitMomentum(
  habitId: string,
  userId: string,
  date: string,
  completed: number
): Promise<number> {
  const db = getDb();
  let momentum = 0;
  
  if (completed > 0) {
    // Get the record from the previous day
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayFormatted = formatDateYYYYMMDD(yesterday);
    
    const previousRecord = await getHabitRecordForDate(habitId, yesterdayFormatted);
    
    if (previousRecord && previousRecord.completed > 0) {
      // If the previous day was completed, increase momentum (streak)
      momentum = Math.min(previousRecord.momentum + 1, 30); // Cap at +30
    } else {
      // No streak or broken streak, start with +1
      momentum = 1;
    }
  } else {
    // Not completed today
    // Get the most recent record before today
    const previousRecords = await db
      .select()
      .from(habitRecords)
      .where(
        and(
          eq(habitRecords.habitId, habitId),
          lt(habitRecords.date, date)
        )
      )
      .orderBy(desc(habitRecords.date))
      .limit(1);
    
    const previousRecord = previousRecords[0];
    
    if (previousRecord) {
      // If momentum was already negative, decrease it further
      if (previousRecord.momentum < 0) {
        momentum = Math.max(previousRecord.momentum - 1, -30); // Cap at -30
      } else {
        // If momentum was positive or zero, reset to 0
        momentum = 0;
      }
    }
  }
  
  return momentum;
}

export async function calculateWeeklyHabitMomentum(
  habit: Habit,
  userId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<number> {
  const db = getDb();
  
  // Get all records for this habit in the current week
  const weekRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        eq(habitRecords.habitId, habit.id),
        gte(habitRecords.date, weekStartDate),
        lte(habitRecords.date, weekEndDate)
      )
    );
  
  // Count total completions for the week
  const completionsThisWeek = weekRecords.reduce((sum, record) => sum + record.completed, 0);
  
  // Find if minimum target was reached
  const targetReached = completionsThisWeek >= (habit.targetCount || 2);
  
  // Base momentum calculation is different for weekly habits
  // We start with the number of completions
  let momentum = completionsThisWeek;
  
  if (targetReached) {
    // Target reached - add significant bonus
    // This ensures the momentum is always at least 10 + number of completions when target is met
    momentum += 10;
    
    // Check for consecutive weekly successes
    const previousWeekEnd = new Date(weekStartDate);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    const previousWeekStart = new Date(previousWeekEnd);
    previousWeekStart.setDate(previousWeekStart.getDate() - 6);
    
    const previousWeekFormatted = {
      start: formatDateYYYYMMDD(previousWeekStart),
      end: formatDateYYYYMMDD(previousWeekEnd)
    };
    
    // Get all records from the previous week
    const previousWeekRecords = await db
      .select()
      .from(habitRecords)
      .where(
        and(
          eq(habitRecords.habitId, habit.id),
          gte(habitRecords.date, previousWeekFormatted.start),
          lte(habitRecords.date, previousWeekFormatted.end)
        )
      );
      
    // Check if previous week also met the target
    const prevWeekCompletions = previousWeekRecords.reduce((sum, record) => sum + record.completed, 0);
    const prevWeekTargetReached = prevWeekCompletions >= (habit.targetCount || 2);
    
    if (prevWeekTargetReached) {
      // If previous week also reached target (consecutive success)
      // Add another significant bonus to create a compounding effect
      momentum = Math.min(momentum + 10, 40); // Cap at +40
    }
  } else if (completionsThisWeek === 0) {
    // No completions this week - penalty
    // Get previous week's record to determine consecutive misses
    const previousWeekEnd = new Date(weekStartDate);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    const previousWeekStart = new Date(previousWeekEnd);
    previousWeekStart.setDate(previousWeekStart.getDate() - 6);
    
    const previousWeekFormatted = {
      start: formatDateYYYYMMDD(previousWeekStart),
      end: formatDateYYYYMMDD(previousWeekEnd)
    };
    
    // Get records from previous week
    const previousWeekRecords = await db
      .select()
      .from(habitRecords)
      .where(
        and(
          eq(habitRecords.habitId, habit.id),
          gte(habitRecords.date, previousWeekFormatted.start),
          lte(habitRecords.date, previousWeekFormatted.end)
        )
      );
    
    const previousWeekCompletions = previousWeekRecords.reduce((sum, record) => sum + record.completed, 0);
    
    if (previousWeekCompletions === 0) {
      // Find the last record before this week to check momentum
      const lastRecord = await db
        .select()
        .from(habitRecords)
        .where(
          and(
            eq(habitRecords.habitId, habit.id),
            lt(habitRecords.date, weekStartDate)
          )
        )
        .orderBy(desc(habitRecords.date))
        .limit(1);
      
      if (lastRecord.length > 0 && lastRecord[0].momentum < 0) {
        // If previous momentum was already negative, decrease it further (consecutive misses)
        momentum = Math.max(lastRecord[0].momentum - 10, -40); // Cap at -40 with -10 decrements
      } else {
        // First miss or no previous record
        momentum = -10;
      }
    } else {
      // Previous week had completions but this week has none
      momentum = -10;
    }
  }
  
  return momentum;
}

// Get total momentum score for a user
export async function getUserTotalMomentum(userId: string): Promise<number> {
  const db = getDb();
  const currentWeek = getDateRangeForWeek();
  const today = getCurrentDateYYYYMMDD();
  
  // Track separate components to help with debugging
  let dailyMomentum = 0;
  let weeklyMomentum = 0;
  // ---------- DAILY HABITS ----------
  // Simple calculation: 1 point per completed daily habit today
  const dailyHabits = await getUserHabits(userId, 'daily');
  
  for (const habit of dailyHabits) {
    const todayRecord = await getHabitRecordForDate(habit.id, today);
    if (todayRecord && todayRecord.completed > 0) {
      dailyMomentum += 1;
    }
  }
  
  // ---------- WEEKLY HABITS ----------
  // For weekly habits, count completions + target bonus
  const weeklyHabits = await getUserHabits(userId, 'weekly');
  for (const habit of weeklyHabits) {
    // Count completed records for this habit in the current week
    const weekRecords = await db
      .select()
      .from(habitRecords)
      .where(
        and(
          eq(habitRecords.habitId, habit.id),
          gte(habitRecords.date, currentWeek.start),
          lte(habitRecords.date, currentWeek.end),
          eq(habitRecords.completed, 1) // Only count completed records
        )
      );
    
    // Add the number of completions
    const completionsThisWeek = weekRecords.length;
    weeklyMomentum += completionsThisWeek;
    
    // Add target bonus if applicable
    if (completionsThisWeek >= (habit.targetCount || 2)) {
      weeklyMomentum += 10;
    }
  }
  
  return dailyMomentum + weeklyMomentum;
}