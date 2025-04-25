import { redirect, error, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserHabits, createHabit, getHabitById, archiveHabit, getDateRangeForWeek, createOrUpdateHabitRecord, calculateWeeklyHabitMomentum, getHabitRecordForDate, formatDateYYYYMMDD } from '$lib/habits';
import { getDb } from '$lib/db/client';
import { habitRecords } from '$lib/db/schema';
import { and, eq, gte, lte, sql, lt } from 'drizzle-orm';
import { getUserById } from '$lib/db/user';

// Load the weekly habits for the logged in user
export const load: PageServerLoad = async ({ locals, depends }) => {
  // Mark data dependencies explicitly with more specific tags
  depends('weekly-habits');
  depends('app:habits');
  
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
  console.log(`Loaded ${weeklyHabits.length} weekly habits for user ${userId}`);
  
  // Get current week's date range
  const currentWeek = getDateRangeForWeek();
  console.log('Current week range:', currentWeek);
  
  const db = getDb();
  
  // Early return if no habits
  if (weeklyHabits.length === 0) {
    return {
      habits: [],
      currentWeek
    };
  }
  
  // Batch fetch all habit records for all habits in one query
  const habitIds = weeklyHabits.map(habit => habit.id);
  console.log('Weekly habit IDs:', habitIds);

  // Get all records for the current week for all habits in a single query
  const allWeekRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        sql`${habitRecords.habitId} IN (${habitIds.join(',')})`,
        gte(habitRecords.date, currentWeek.start),
        lte(habitRecords.date, currentWeek.end)
      )
    );
  
  // Get momentum history records for all habits in a single query
  // Calculate the date 8 weeks ago
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56); // 8 weeks * 7 days
  
  const allMomentumHistoryRecords = await db
    .select()
    .from(habitRecords)
    .where(
      and(
        sql`${habitRecords.habitId} IN (${habitIds.join(',')})`,
        gte(habitRecords.date, formatDateYYYYMMDD(eightWeeksAgo))
      )
    )
    .orderBy(habitRecords.date);
  
  // Group records by habit ID for faster lookups
  const weekRecordsByHabitId = {};
  const momentumHistoryByHabitId = {};
  
  // Initialize with empty arrays
  habitIds.forEach(id => {
    weekRecordsByHabitId[id] = [];
    momentumHistoryByHabitId[id] = [];
  });
  
  // Populate week records by habit ID
  allWeekRecords.forEach(record => {
    if (weekRecordsByHabitId[record.habitId]) {
      weekRecordsByHabitId[record.habitId].push(record);
    }
  });
  
  // Group momentum history records by habit ID
  allMomentumHistoryRecords.forEach(record => {
    if (momentumHistoryByHabitId[record.habitId]) {
      momentumHistoryByHabitId[record.habitId].push(record);
    }
  });
  
  // Process each habit in parallel with pre-fetched data
  const habitsWithRecords = await Promise.all(
    weeklyHabits.map(async (habit) => {
      // Get this habit's week records from our pre-fetched data
      let records = weekRecordsByHabitId[habit.id] || [];
      
      // Ensure date is properly formatted for ALL records - critical fix
      records = records.map(record => ({
        ...record,
        date: record.date ? record.date.split('T')[0] : record.date
      }));
      
      // Debug logging for records
      console.log(`Weekly habit ${habit.name} (${habit.id}) has ${records.length} records this week:`);
      records.forEach(record => {
        console.log(`Record: date=${record.date}, completed=${record.completed}, momentum=${record.momentum}`);
      });
      
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

      // Process momentum history using pre-fetched data
      const habitMomentumRecords = momentumHistoryByHabitId[habit.id] || [];
      
      // Format momentum history records too
      const formattedMomentumRecords = habitMomentumRecords.map(record => ({
        ...record,
        date: record.date ? record.date.split('T')[0] : record.date
      }));
      
      // Group records by week to get a single data point per week
      const weeklyMomentumMap = new Map();
      
      formattedMomentumRecords.forEach(record => {
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
        currentMomentum,
        momentumHistory,
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
    console.log('WEEKLY TRACKING: Starting habit tracking action');
    
    const session = await locals.auth();
    if (!session || !session.user?.id) {
      console.error('WEEKLY TRACKING: Unauthorized - no session or user ID');
      throw error(401, 'Unauthorized');
    }
    
    const userId = session.user.id;
    console.log(`WEEKLY TRACKING: User ID: ${userId}`);
    
    const data = await request.formData();
    const habitId = data.get('habitId')?.toString();
    
    // Always standardize the date to YYYY-MM-DD format
    let dateFromForm = data.get('date')?.toString();
    if (!dateFromForm) {
      dateFromForm = formatDateYYYYMMDD(new Date());
    }
    
    // Ensure the date is in YYYY-MM-DD format
    const date = dateFromForm.split('T')[0]; // Remove any time component
    
    console.log(`WEEKLY TRACKING: Habit ID: ${habitId}, Standardized Date: ${date}`);
    
    if (!habitId) {
      console.error('WEEKLY TRACKING: Missing habit ID');
      return { success: false, error: 'Habit ID is required' };
    }
    
    try {
      // Verify that this habit belongs to the user
      const habit = await getHabitById(habitId);
      if (!habit || habit.userId !== session.user.id) {
        console.error('WEEKLY TRACKING: Habit not found or access denied');
        return { success: false, error: 'Habit not found or access denied' };
      }
      
      console.log(`WEEKLY TRACKING: Habit found: ${habit.name}`);
      
      const db = getDb();
      
      // Check if a record already exists for this date - use direct query with explicit format
      const existingRecords = await db
        .select()
        .from(habitRecords)
        .where(
          and(
            eq(habitRecords.habitId, habitId),
            eq(habitRecords.date, date)
          )
        )
        .limit(1);
      
      const existingRecord = existingRecords[0];
      console.log(`WEEKLY TRACKING: Existing record found:`, existingRecord);
      
      // If record already exists and completed, we're toggling off
      const completed = existingRecord?.completed > 0 ? 0 : 1;
      console.log(`WEEKLY TRACKING: Setting completed to: ${completed} (toggled from ${existingRecord?.completed})`);
      
      // Get current week date range for the selected date
      const currentWeek = getDateRangeForWeek(new Date(date));
      console.log(`WEEKLY TRACKING: Current week: ${currentWeek.start} to ${currentWeek.end}`);
      
      // Calculate momentum based on all completions in the week
      const momentum = await calculateWeeklyHabitMomentum(
        habit,
        userId,
        currentWeek.start,
        currentWeek.end
      );
      
      console.log(`WEEKLY TRACKING: Calculated momentum for habit ${habit.name}: ${momentum}`);
      
      // Create or update the record for this date
      let recordResult;
      
      if (existingRecord) {
        // Update the existing record
        const [updated] = await db
          .update(habitRecords)
          .set({ 
            completed, 
            momentum,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(habitRecords.id, existingRecord.id),
              eq(habitRecords.habitId, habitId)
            )
          )
          .returning();
        
        recordResult = updated;
        console.log('WEEKLY TRACKING: Updated record:', recordResult);
      } else {
        // Create a new record
        const [newRecord] = await db
          .insert(habitRecords)
          .values({
            id: habitId + "-" + date, // Use a deterministic ID 
            habitId,
            userId,
            date,
            completed,
            momentum,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        recordResult = newRecord;
        console.log('WEEKLY TRACKING: Created new record:', recordResult);
      }
      
      // For weekly habits, we need to update ALL records for this week with the new momentum
      // This ensures consistency in momentum across the week
      const updateResult = await db
        .update(habitRecords)
        .set({ momentum })
        .where(
          and(
            eq(habitRecords.habitId, habitId),
            gte(habitRecords.date, currentWeek.start),
            lte(habitRecords.date, currentWeek.end)
          )
        );
      
      console.log('WEEKLY TRACKING: Updated all records for the week with new momentum:', updateResult);
      
      return { success: true, completed, momentum };
    } catch (err) {
      console.error('WEEKLY TRACKING Error:', err);
      return { success: false, error: `Failed to track habit: ${err.message}` };
    }
  }
};