import { getDb } from './db/client';
import { habits, habitRecords, users } from './db/schema';
import { eq, and, sql, desc, gte, lte, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Type definitions
export type Habit = typeof habits.$inferSelect;
export type HabitRecord = typeof habitRecords.$inferSelect;
export type NewHabitRecord = typeof habitRecords.$inferInsert;
export type NewHabit = typeof habits.$inferInsert;

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
// Get a habit record for a specific date
export async function getHabitRecordForDate(habitId: string, date: string): Promise<any | null> {
  console.log(`Looking for habit record: habitId=${habitId}, date=${date}`);
  
  try {
    const db = getDb();
    const records = await db
      .select()
      .from(habitRecords)
      .where(
        and(
          eq(habitRecords.habitId, habitId),
          eq(habitRecords.date, date)
        )
      )
      .limit(1);
    
    const record = records[0] || null;
    console.log(`Found habit record for date ${date}:`, record);
    return record;
  } catch (error) {
    console.error('Error getting habit record for date:', error);
    return null;
  }
}

// Create or update a habit record for a specific date
export async function createOrUpdateHabitRecord({ 
  habitId, 
  userId, 
  date, 
  completed = 1,
  momentum = null 
}: { 
  habitId: string; 
  userId: string; 
  date: string; 
  completed?: number;
  momentum?: number | null;
}): Promise<any> {
  
  console.log(`Creating/updating habit record: habitId=${habitId}, userId=${userId}, date=${date}, completed=${completed}, momentum=${momentum}`);
  
  // Standardize date format to YYYY-MM-DD to ensure consistency
  const standardDate = date.split('T')[0];
  
  try {
    const db = getDb();
    
    // Check if record already exists
    const existingRecord = await getHabitRecordForDate(habitId, standardDate);
    
    // Get the habit to update its accumulated momentum
    const habit = await getHabitById(habitId);
    if (!habit) {
      throw new Error(`Habit with ID ${habitId} not found`);
    }
    
    const momentumChange = momentum !== null ? momentum : 0;
    let oldMomentum = 0;
    let updatedRecord;
    
    if (existingRecord) {
      console.log(`Updating existing record for ${standardDate}`);
      
      // Calculate momentum change (new momentum - old momentum)
      oldMomentum = existingRecord.momentum || 0;
      
      // Update existing record
      [updatedRecord] = await db
        .update(habitRecords)
        .set({ 
          completed, 
          momentum: momentum !== null ? momentum : existingRecord.momentum
        })
        .where(
          and(
            eq(habitRecords.habitId, habitId),
            eq(habitRecords.date, standardDate)
          )
        )
        .returning();
      
      console.log(`Updated record:`, updatedRecord);
    } else {
      console.log(`Creating new record for ${standardDate}`);
      
      // Create new record
      [updatedRecord] = await db
        .insert(habitRecords)
        .values({
          id: nanoid(),
          habitId,
          userId,
          date: standardDate,
          completed,
          momentum: momentum || 0,
          createdAt: new Date()
        })
        .returning();
      
      console.log(`Created new record:`, updatedRecord);
    }
    
    // Calculate the net change in momentum
    const newMomentum = updatedRecord.momentum || 0;
    const netChange = newMomentum - oldMomentum;
    
    // Only update accumulated momentum if there's a change
    if (netChange !== 0) {
      // Update the habit's accumulated momentum
      const newAccumulatedMomentum = (habit.accumulatedMomentum || 0) + netChange;
      console.log(`Updating habit's accumulated momentum: ${habit.accumulatedMomentum || 0} + ${netChange} = ${newAccumulatedMomentum}`);
      
      await db
        .update(habits)
        .set({ 
          accumulatedMomentum: newAccumulatedMomentum
        })
        .where(eq(habits.id, habitId));
    }
    
    return updatedRecord;
  } catch (error) {
    console.error('Error creating/updating habit record:', error);
    throw error;
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
  
  // Count total completions for the week - sum the actual completed values
  const completionsThisWeek = weekRecords.reduce((sum, record) => sum + record.completed, 0);
  
  console.log(`Weekly habit "${habit.name}" (${habit.id}): ${completionsThisWeek} completions this week`);
  
  // Find if minimum target was reached
  const targetReached = completionsThisWeek >= (habit.targetCount || 2);
  
  // Base momentum calculation - ALWAYS add actual completion count
  let momentum = completionsThisWeek;
  
  if (targetReached) {
    // Target reached - add significant bonus
    // This ensures the momentum is always at least 10 + number of completions when target is met
    momentum += 10;
    console.log(`Momentum after target bonus: ${momentum}`);
    
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
      console.log(`Momentum after consecutive bonus: ${momentum}`);
    }
  } else if (completionsThisWeek >= 1) {
    // At least one tracking but didn't reach the target
    // No additional logic needed - momentum is already set to completionsThisWeek above
    // This ensures each tracking counts as +1 regardless of target
    console.log(`Momentum without target reached: ${momentum}`);
  } else {
    // No completions this week - reset momentum to 0 and potentially decrease
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
        // First miss or no previous record - reset to 0 for the first miss
        momentum = 0;
      }
    } else {
      // Previous week had completions but this week has none
      // Reset to 0 according to requirements
      momentum = 0;
    }
  }
  
  console.log(`Final momentum for "${habit.name}" (${habit.id}): ${momentum}`);
  return momentum;
}

// Get total momentum score for a user
export async function getUserTotalMomentum(userId: string): Promise<number> {
  const db = getDb();
  const currentWeek = getDateRangeForWeek();
  const today = getCurrentDateYYYYMMDD();
  console.log(`Calculating total momentum for today ${today} in week ${currentWeek.start} to ${currentWeek.end}`);
  
  // Import the inArray operator
  const { inArray } = await import('drizzle-orm');
  
  // Track separate components to help with debugging
  let dailyMomentum = 0;
  let weeklyMomentum = 0;
  
  // OPTIMIZATION: Pre-fetch all habits for this user once
  const [dailyHabits, weeklyHabits] = await Promise.all([
    getUserHabits(userId, 'daily'),
    getUserHabits(userId, 'weekly')
  ]);
  
  console.log(`Found ${dailyHabits.length} daily habits and ${weeklyHabits.length} weekly habits`);
  
  // ---------- DAILY HABITS ----------
  // For accumulated momentum, get all records for the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today and the past 6 days
  const sevenDaysAgoStr = formatDateYYYYMMDD(sevenDaysAgo);
  
  // Get all daily habit records for the last 7 days
  const dailyHabitRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        inArray(habitRecords.habitId, dailyHabits.map(h => h.id)),
        gte(habitRecords.date, sevenDaysAgoStr),
        lte(habitRecords.date, today)
      )
    );
    
  console.log(`Found ${dailyHabitRecords.length} daily habit records in the last 7 days`);
  
  // Group records by habit ID
  const recordsByHabitId = new Map();
  dailyHabitRecords.forEach(record => {
    if (!recordsByHabitId.has(record.habitId)) {
      recordsByHabitId.set(record.habitId, []);
    }
    recordsByHabitId.get(record.habitId).push(record);
  });
  
  // Calculate accumulated momentum for each habit
  for (const habit of dailyHabits) {
    const habitRecords = recordsByHabitId.get(habit.id) || [];
    
    // Check if we have records for this habit
    if (habitRecords.length > 0) {
      // Add up all positive momentum values
      const habitMomentum = habitRecords
        .filter(record => record.momentum > 0)
        .reduce((sum, record) => sum + record.momentum, 0);
      
      dailyMomentum += habitMomentum;
      console.log(`Habit "${habit.name}" accumulated momentum: ${habitMomentum}`);
    } else {
      // No records for this habit, check if we should preserve streak from yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayFormatted = formatDateYYYYMMDD(yesterday);
      
      const previousRecord = await getHabitRecordForDate(habit.id, yesterdayFormatted);
      
      if (previousRecord && previousRecord.completed > 0 && previousRecord.momentum > 0) {
        dailyMomentum += previousRecord.momentum;
        console.log(`Adding ${previousRecord.momentum} points to daily momentum from habit "${habit.name}" - preserved streak from yesterday`);
      }
    }
  }
  
  console.log(`Daily habits accumulated momentum: ${dailyMomentum}`);
  
  // ---------- WEEKLY HABITS ----------
  // For weekly habits, consider completions from the last 14 days for consistency with getMomentumHistory
  if (weeklyHabits.length > 0) {
    // Get date 14 days ago
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = formatDateYYYYMMDD(twoWeeksAgo);
    
    // Get all weekly habit records from the last 14 days in a single query
    const weeklyRecords = await db
      .select()
      .from(habitRecords)
      .where(
        and(
          inArray(habitRecords.habitId, weeklyHabits.map(h => h.id)),
          gte(habitRecords.date, twoWeeksAgoStr),
          lte(habitRecords.date, today),
          eq(habitRecords.completed, 1)
        )
      );
    
    console.log(`Found ${weeklyRecords.length} completed weekly habit records in the last 14 days`);
    
    // Count completions by habit
    const weeklyCompletionsByHabit = new Map<string, number>();
    weeklyHabits.forEach(habit => weeklyCompletionsByHabit.set(habit.id, 0));
    
    weeklyRecords.forEach(record => {
      const count = weeklyCompletionsByHabit.get(record.habitId) || 0;
      weeklyCompletionsByHabit.set(record.habitId, count + 1);
    });
    
    // Calculate momentum for each weekly habit
    for (const habit of weeklyHabits) {
      const totalCompletions = weeklyCompletionsByHabit.get(habit.id) || 0;
      
      // Add the number of completions to the momentum
      weeklyMomentum += totalCompletions;
      
      // Add target bonus if applicable
      if (totalCompletions >= (habit.targetCount || 2)) {
        weeklyMomentum += 10;
      }
      
      console.log(`Weekly habit "${habit.name}" (${habit.id}): ${totalCompletions}/${habit.targetCount || 2} completions in last 14 days, adds ${totalCompletions + (totalCompletions >= (habit.targetCount || 2) ? 10 : 0)} to momentum`);
    }
  }
  
  const totalMomentum = dailyMomentum + weeklyMomentum;
  console.log(`Total momentum: ${dailyMomentum} (daily) + ${weeklyMomentum} (weekly) = ${totalMomentum}`);
  
  return totalMomentum;
}

// Get momentum history for the last 30 days
export async function getMomentumHistory(userId: string, days: number = 30): Promise<{ date: string; momentum: number }[]> {
  const db = getDb();
  
  // Get end date (today) and start date (n days ago)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1)); // Subtract days-1 to include today
  
  // Format dates properly
  const endDateStr = formatDateYYYYMMDD(endDate);
  const startDateStr = formatDateYYYYMMDD(startDate);
  
  console.log(`Calculating momentum history from ${startDateStr} to ${endDateStr}`);
  
  // Import the inArray operator directly for proper query building
  const { inArray } = await import('drizzle-orm');
  
  // OPTIMIZATION: Pre-fetch all habits for this user once
  const [dailyHabits, weeklyHabits] = await Promise.all([
    getUserHabits(userId, 'daily'),
    getUserHabits(userId, 'weekly')
  ]);
  
  console.log(`Found ${dailyHabits.length} daily habits and ${weeklyHabits.length} weekly habits`);
  
  // Get all habit IDs to use in queries
  const allHabitIds = [...dailyHabits, ...weeklyHabits].map(habit => habit.id);
  
  // Early return if no habits exist
  if (allHabitIds.length === 0) {
    console.log("No habits found, returning empty momentum history");
    return [];
  }
  
  // OPTIMIZATION: Fetch all relevant habit records in a single query
  // Include records from before the start date to properly calculate weekly momentum
  // We need to get records from at most 14 days before the start date to account for weekly habits across multiple weeks
  const extendedStartDate = new Date(startDate);
  extendedStartDate.setDate(extendedStartDate.getDate() - 14); // Expand to 14 days prior to catch more weekly records
  const extendedStartDateStr = formatDateYYYYMMDD(extendedStartDate);
  
  // Use proper inArray operator instead of SQL template string
  const allHabitRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        eq(habitRecords.userId, userId),
        gte(habitRecords.date, extendedStartDateStr),
        lte(habitRecords.date, endDateStr),
        inArray(habitRecords.habitId, allHabitIds)
      )
    );
  
  console.log(`Found ${allHabitRecords.length} habit records in extended date range ${extendedStartDateStr} to ${endDateStr}`);
  
  // Group records by habit ID for easier processing
  const recordsByHabitId = new Map<string, HabitRecord[]>();
  allHabitIds.forEach(id => recordsByHabitId.set(id, []));
  
  allHabitRecords.forEach(record => {
    const habitRecords = recordsByHabitId.get(record.habitId) || [];
    habitRecords.push(record);
    recordsByHabitId.set(record.habitId, habitRecords);
  });
  
  // Debug log for habit record counts
  allHabitIds.forEach(id => {
    const habit = [...dailyHabits, ...weeklyHabits].find(h => h.id === id);
    const records = recordsByHabitId.get(id) || [];
    console.log(`Habit "${habit?.name}" (${id}) has ${records.length} records, type: ${habit?.type}`);
  });
  
  // Create lookup for daily habit records by date
  const recordsByHabitAndDate = new Map<string, HabitRecord>();
  
  // Organize daily records for quick lookup
  allHabitRecords.forEach(record => {
    // Map for easy habit lookup on a specific date
    const key = `${record.habitId}_${record.date}`;
    recordsByHabitAndDate.set(key, record);
  });
  
  // Count completed records for each weekly habit in the most recent 14 days
  // This ensures we capture completions across multiple weeks
  const weeklyCompletionsByHabit = new Map<string, number>();
  
  // Find the most recent date in our data
  const mostRecentDate = new Date(endDateStr);
  // Get date 14 days before most recent date
  const twoWeeksAgo = new Date(mostRecentDate);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = formatDateYYYYMMDD(twoWeeksAgo);
  
  // Count completions in the last 14 days for each weekly habit
  weeklyHabits.forEach(habit => {
    const habitRecords = recordsByHabitId.get(habit.id) || [];
    // Filter to only include records in the last 14 days that are completed
    const recentCompletedRecords = habitRecords.filter(record => {
      return record.date >= twoWeeksAgoStr && record.completed > 0;
    });
    const completionCount = recentCompletedRecords.length;
    weeklyCompletionsByHabit.set(habit.id, completionCount);
    
    console.log(`Habit "${habit.name}" (${habit.id}) has ${completionCount} completed records in last 14 days`);
  });
  
  // Generate result for each day in the requested date range
  const result: { date: string; momentum: number }[] = [];
  const dateArray: string[] = [];
  
  // Create array of all dates in the range
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateArray.push(formatDateYYYYMMDD(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Process each date
  for (const dateStr of dateArray) {
    let dailyMomentum = 0;
    let weeklyMomentum = 0;
    
    // ---------- DAILY HABITS ----------
    // For each daily habit, calculate accumulated momentum from all records
    for (const habit of dailyHabits) {
      let habitAccumulatedMomentum = 0;
      
      // Get all records for this habit up to and including this date
      const habitRecords = recordsByHabitId.get(habit.id) || [];
      const recordsUpToDate = habitRecords.filter(record => 
        record.date <= dateStr && 
        record.date >= startDateStr && 
        record.momentum > 0
      );
      
      // Add up all positive momentum values
      if (recordsUpToDate.length > 0) {
        habitAccumulatedMomentum = recordsUpToDate.reduce((sum, record) => sum + record.momentum, 0);
        console.log(`[History] Date ${dateStr}, habit "${habit.name}": accumulated momentum = ${habitAccumulatedMomentum}`);
      } 
      
      // For today only, if no record exists but has streak from yesterday
      if (dateStr === endDateStr && habitAccumulatedMomentum === 0) {
        const prevDate = new Date(dateStr);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = formatDateYYYYMMDD(prevDate);
        const prevKey = `${habit.id}_${prevDateStr}`;
        const prevRecord = recordsByHabitAndDate.get(prevKey);
        
        if (prevRecord && prevRecord.completed > 0 && prevRecord.momentum > 0) {
          // Add the previous day's momentum for preserved streak
          habitAccumulatedMomentum = prevRecord.momentum;
          console.log(`[History] Date ${dateStr}: Preserving streak momentum ${prevRecord.momentum} for habit "${habit.name}"`);
        }
      }
      
      // Add this habit's accumulated momentum to the total
      dailyMomentum += habitAccumulatedMomentum;
    }
    
    // ---------- WEEKLY HABITS ----------
    // Get week date range for this date
    const dateObj = new Date(dateStr);
    const currentWeek = getDateRangeForWeek(dateObj);
    
    // Special handling for the most recent week (add recent records across weeks)
    const isCurrentWeek = currentWeek.start === getDateRangeForWeek(mostRecentDate).start;
    
    // Process each weekly habit separately
    weeklyHabits.forEach(habit => {
      // Get all records for this habit
      const habitRecords = recordsByHabitId.get(habit.id) || [];
      
      // Calculate habit momentum differently depending on whether it's the current week
      if (isCurrentWeek) {
        // For the current week, use the pre-calculated completions across multiple weeks
        const totalCompletions = weeklyCompletionsByHabit.get(habit.id) || 0;
        
        // Base points are the number of completions
        let habitMomentum = totalCompletions;
        
        // Add target bonus if applicable
        const targetCount = habit.targetCount || 2;
        if (totalCompletions >= targetCount) {
          habitMomentum += 10;
        }
        
        // Add to weekly momentum
        weeklyMomentum += habitMomentum;
        
        console.log(`CURRENT WEEK - Date ${dateStr}, habit "${habit.name}" (${habit.id}): all completions=${totalCompletions}/${targetCount}, contributes=${habitMomentum} points`);
      } else {
        // For past weeks, only count completions within that specific week
        // Convert week range strings to Date objects for proper comparison
        const weekStartDate = new Date(currentWeek.start + "T00:00:00Z");
        const weekEndDate = new Date(currentWeek.end + "T23:59:59Z");
        
        // Count completions this week
        const completionsThisWeek = habitRecords.filter(record => {
          const recordDate = new Date(record.date + "T00:00:00Z");
          return record.completed > 0 && 
                recordDate >= weekStartDate && 
                recordDate <= weekEndDate;
        }).length;
        
        // Calculate momentum for this habit
        let habitMomentum = completionsThisWeek;
        
        // Add target bonus if applicable
        const targetCount = habit.targetCount || 2;
        if (completionsThisWeek >= targetCount) {
          habitMomentum += 10;
        }
        
        // Add this habit's momentum to the weekly total
        weeklyMomentum += habitMomentum;
        
        console.log(`Date ${dateStr}, habit "${habit.name}" (${habit.id}): completions=${completionsThisWeek}/${targetCount}, contributes=${habitMomentum} points`);
      }
    });
    
    // Calculate total momentum for this day
    const totalMomentum = dailyMomentum + weeklyMomentum;
    
    console.log(`Date ${dateStr} (week ${currentWeek.start} to ${currentWeek.end}): daily=${dailyMomentum}, weekly=${weeklyMomentum}, total=${totalMomentum}`);
    
    // Add to result
    result.push({
      date: dateStr,
      momentum: totalMomentum
    });
  }
  
  console.log(`Generated momentum history with ${result.length} days`);
  return result;
}

// Get the correct momentum for a daily habit on a specific date
// This preserves streak momentum when there's no record for the current day
export async function getDailyHabitMomentumForDate(
  habitId: string,
  userId: string,
  date: string,
  completed: number = 0
): Promise<number> {
  const db = getDb();
  
  // If completed, use the standard momentum calculation
  if (completed > 0) {
    return calculateDailyHabitMomentum(habitId, userId, date, completed);
  }
  
  // Not completed or no record for today - check previous day's record
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFormatted = formatDateYYYYMMDD(yesterday);
  
  const previousRecord = await getHabitRecordForDate(habitId, yesterdayFormatted);
  
  // If previous day was completed and had positive momentum, preserve that momentum
  if (previousRecord && previousRecord.completed > 0 && previousRecord.momentum > 0) {
    console.log(`Preserving momentum ${previousRecord.momentum} from previous day for habit ${habitId}`);
    return previousRecord.momentum;
  }
  
  // Otherwise use the standard calculation (which will likely return 0)
  return calculateDailyHabitMomentum(habitId, userId, date, completed);
}