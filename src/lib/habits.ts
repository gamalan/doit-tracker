import { getDb } from './db/client';
import { habits, habitRecords, users } from './db/schema';
import { eq, and, sql, desc, gte, lte, lt, inArray } from 'drizzle-orm';
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

export function getDateRangeForWeek(date: Date = new Date()): { start: string; end: string } {
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
			.where(and(eq(habitRecords.habitId, habitId), eq(habitRecords.date, date)))
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
	console.log(
		`Creating/updating habit record: habitId=${habitId}, userId=${userId}, date=${date}, completed=${completed}, momentum=${momentum}`
	);

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

		let momentumToApply = momentum;
		let oldMomentum = 0;
		let updatedRecord;

		// For daily habits, find the most recent record to check for missed days
		const lastRecord = await db
			.select()
			.from(habitRecords)
			.where(and(eq(habitRecords.habitId, habitId), lt(habitRecords.date, standardDate)))
			.orderBy(desc(habitRecords.date))
			.limit(1);

		const lastRecordEntry = lastRecord[0];

		if (habit.type === 'daily') {
			// If we have a previous record and momentum isn't explicitly provided
			if (lastRecordEntry && momentum === null) {
				const lastDate = new Date(lastRecordEntry.date);
				const currentDate = new Date(standardDate);

				// Calculate the gap between the last record and current date (in days)
				const dayGap = Math.floor(
					(currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
				);

				console.log(
					`Last record was on ${lastRecordEntry.date}, current date is ${standardDate}, gap: ${dayGap} days`
				);

				if (dayGap > 1) {
					// Simplified missing day logic according to requirements
					console.log(`Found gap of ${dayGap} days in tracking for habit ${habitId}`);

					if (completed > 0) {
						// If completing today after missing days, reset to +1
						momentumToApply = 1;
						console.log(`Completing after ${dayGap - 1} missed days. Resetting momentum to +1`);
					} else {
						// Not completed and missed previous days - apply penalty
						// Start from 0 (streak broken) and subtract 1 for each consecutive miss (min -3)
						momentumToApply = Math.max(-dayGap, -3);
						console.log(
							`Not completed after ${dayGap} total missed days. Momentum: ${momentumToApply}`
						);
					}
				} else if (completed > 0) {
					// Normal consecutive day tracking - calculate streak momentum
					if (lastRecordEntry.completed > 0) {
						// Continue streak
						momentumToApply = Math.min(lastRecordEntry.momentum + 1, 7); // Cap at +7
						console.log(`Continuing streak, momentum: ${momentumToApply}`);
					} else {
						// Previous day not completed, start new streak
						momentumToApply = 1;
						console.log(`Starting new streak, momentum: +1`);
					}
				} else {
					// Not completed today, after completing yesterday
					if (lastRecordEntry.momentum > 0) {
						// Reset positive momentum to 0
						momentumToApply = 0;
						console.log(`Not completed today, resetting momentum to 0`);
					} else {
						// Continue decreasing negative momentum
						momentumToApply = Math.max(lastRecordEntry.momentum - 1, -3); // Cap at -3
						console.log(`Not completed today, decreasing momentum to ${momentumToApply}`);
					}
				}
			} else if (momentum === null) {
				// No previous records, use default momentum based on completion
				momentumToApply = completed > 0 ? 1 : 0;
				console.log(`No previous records found, setting initial momentum to ${momentumToApply}`);
			}
		}

		if (existingRecord) {
			console.log(`Updating existing record for ${standardDate}`);

			// Calculate momentum change (new momentum - old momentum)
			oldMomentum = existingRecord.momentum || 0;

			// Update existing record
			[updatedRecord] = await db
				.update(habitRecords)
				.set({
					completed,
					momentum: momentumToApply !== null ? momentumToApply : existingRecord.momentum
				})
				.where(and(eq(habitRecords.habitId, habitId), eq(habitRecords.date, standardDate)))
				.returning();

			console.log(`Updated record:`, updatedRecord);
		} else {
			console.log(`Creating new record for ${standardDate}`);

			// For new records, we need to track what the "old" momentum was to calculate the delta
			// This is the momentum from the most recent previous record (if any)
			if (habit.type === 'daily' && lastRecordEntry) {
				oldMomentum = lastRecordEntry.momentum || 0;
				console.log(`Previous record momentum for delta calculation: ${oldMomentum}`);
			}

			// Create new record
			[updatedRecord] = await db
				.insert(habitRecords)
				.values({
					id: nanoid(),
					habitId,
					userId,
					date: standardDate,
					completed,
					momentum: momentumToApply !== null ? momentumToApply : 0,
					createdAt: new Date()
				})
				.returning();

			console.log(`Created new record:`, updatedRecord);
		}

		// Handle weekly and daily habits differently when updating accumulated momentum
		if (habit.type === 'weekly') {
			// For weekly habits, DON'T update accumulated momentum during tracking
			// Accumulated momentum is only updated at the end of the week by the cron job
			// The momentum field in the record represents the current week's momentum
			console.log(
				`Weekly habit: momentum=${updatedRecord.momentum}, accumulated momentum will be updated by cron at week end`
			);
		} else {
			// For daily habits, use the existing delta-based logic
			const newMomentum = updatedRecord.momentum || 0;
			const netChange = newMomentum - oldMomentum;

			// Only update accumulated momentum if there's a change
			if (netChange !== 0) {
				// Update the habit's accumulated momentum
				// Note: Allow negative accumulated momentum for daily habits (can go down to -3 per day)
				const newAccumulatedMomentum = (habit.accumulatedMomentum || 0) + netChange;
				console.log(
					`Daily habit: updating accumulated momentum: ${habit.accumulatedMomentum || 0} + ${netChange} = ${newAccumulatedMomentum}`
				);

				await db
					.update(habits)
					.set({
						accumulatedMomentum: newAccumulatedMomentum
					})
					.where(eq(habits.id, habitId));
			}
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
	_userId: string,
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
			momentum = Math.min(previousRecord.momentum + 1, 7); // Cap at +7
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
			.where(and(eq(habitRecords.habitId, habitId), lt(habitRecords.date, date)))
			.orderBy(desc(habitRecords.date))
			.limit(1);

		const previousRecord = previousRecords[0];

		if (previousRecord) {
			// If momentum was already negative, decrease it further
			if (previousRecord.momentum < 0) {
				momentum = Math.max(previousRecord.momentum - 1, -3); // Cap at -3
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

	// OPTIMIZATION: Batch fetch all needed data in one query
	// Get current week + previous week + any records before current week in one go
	const previousWeekEnd = new Date(weekStartDate);
	previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
	const previousWeekStart = new Date(previousWeekEnd);
	previousWeekStart.setDate(previousWeekStart.getDate() - 6);

	const earliestDate = formatDateYYYYMMDD(previousWeekStart);

	// Single query to get all relevant records
	const allRecords = await db
		.select()
		.from(habitRecords)
		.where(
			and(
				eq(habitRecords.habitId, habit.id),
				gte(habitRecords.date, earliestDate),
				lte(habitRecords.date, weekEndDate)
			)
		)
		.orderBy(desc(habitRecords.date));

	// Separate records by week
	const currentWeekRecords = allRecords.filter(
		(r) => r.date >= weekStartDate && r.date <= weekEndDate
	);
	const previousWeekRecords = allRecords.filter(
		(r) =>
			r.date >= formatDateYYYYMMDD(previousWeekStart) &&
			r.date <= formatDateYYYYMMDD(previousWeekEnd)
	);

	// Count completions for current and previous week
	const completionsThisWeek = currentWeekRecords.reduce((sum, record) => sum + record.completed, 0);
	const prevWeekCompletions = previousWeekRecords.reduce(
		(sum, record) => sum + record.completed,
		0
	);

	console.log(
		`Weekly habit "${habit.name}" (${habit.id}): ${completionsThisWeek} completions this week`
	);

	// Find if minimum target was reached
	const targetReached = completionsThisWeek >= (habit.targetCount || 2);
	const prevWeekTargetReached = prevWeekCompletions >= (habit.targetCount || 2);

	// Base momentum calculation - ALWAYS add actual completion count
	let momentum = completionsThisWeek;

	if (targetReached) {
		// Target reached - add significant bonus
		momentum += 10;
		console.log(`Momentum after target bonus: ${momentum}`);

		if (prevWeekTargetReached) {
			// If previous week also reached target (consecutive success)
			momentum += 10; // Consecutive bonus
			momentum = Math.min(momentum, 40); // Cap at +40
			console.log(`Momentum after consecutive bonus: ${momentum}`);
		}
	} else {
		// Target NOT reached - need to check for consecutive misses and apply penalty
		console.log(`Target not reached (${completionsThisWeek}/${habit.targetCount || 2})`);

		if (!prevWeekTargetReached) {
			// Previous week also didn't meet target - this is a consecutive miss
			// Count consecutive misses by looking back through records
			let consecutiveMisses = 1; // Current week is a miss

			// Find all records before this week, sorted by date descending
			const recordsBeforeWeek = allRecords
				.filter((r) => r.date < weekStartDate)
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

			if (recordsBeforeWeek.length > 0) {
				// Look at the most recent record's momentum to determine consecutive miss count
				const lastMomentum = recordsBeforeWeek[0].momentum;

				// If last momentum had a penalty, extract the consecutive miss count from it
				// Penalty pattern: first miss = 0, second = -10, third = -20, fourth+ = -30
				if (lastMomentum < completionsThisWeek) {
					// There was a penalty before, so there were previous consecutive misses
					const previousPenalty = lastMomentum - prevWeekCompletions;

					if (previousPenalty === 0) {
						// Previous week was first miss (no penalty)
						consecutiveMisses = 2; // Now on second consecutive miss
					} else if (previousPenalty === -10) {
						consecutiveMisses = 3; // Now on third
					} else if (previousPenalty <= -20) {
						consecutiveMisses = 4; // Now on fourth or more (capped)
					}
				} else {
					// Previous week was also a miss but was the first one (no penalty)
					consecutiveMisses = 2; // Now on second consecutive miss
				}
			}

			// Apply penalty based on consecutive miss count
			// 1st miss: no penalty, 2nd: -10, 3rd: -20, 4th+: -30
			let penalty = 0;
			if (consecutiveMisses === 2) {
				penalty = -10;
			} else if (consecutiveMisses === 3) {
				penalty = -20;
			} else if (consecutiveMisses >= 4) {
				penalty = -30; // Capped
			}

			momentum += penalty;
			console.log(
				`Consecutive miss #${consecutiveMisses}, penalty: ${penalty}, final momentum: ${momentum}`
			);
		} else {
			// Previous week met target, this is first miss - no penalty yet
			console.log(`First miss after success, no penalty (momentum = ${momentum})`);
		}
	}

	console.log(`Final momentum for "${habit.name}" (${habit.id}): ${momentum}`);
	return momentum;
}

// Get total momentum score for a user
export async function getUserTotalMomentum(userId: string): Promise<number> {
	console.log(`Calculating total momentum using the same logic as momentum history`);

	// Get momentum history for the last 30 days to ensure we have data
	const momentumHistory = await getMomentumHistory(userId, 30);

	if (momentumHistory.length === 0) {
		console.log(`No momentum history found, returning 0`);
		return 0;
	}

	// Return the most recent momentum value (last entry in the array)
	const totalMomentum = momentumHistory[momentumHistory.length - 1].momentum;
	console.log(`Total momentum from history (${momentumHistory.length} days): ${totalMomentum}`);
	console.log(
		`Last momentum entry:`,
		JSON.stringify(momentumHistory[momentumHistory.length - 1], null, 2)
	);

	// Also check what the old calculation would return for comparison
	const db = getDb();
	const [dailyHabits, weeklyHabits] = await Promise.all([
		getUserHabits(userId, 'daily'),
		getUserHabits(userId, 'weekly')
	]);

	let oldCalculation = 0;
	for (const habit of [...dailyHabits, ...weeklyHabits]) {
		oldCalculation += habit.accumulatedMomentum || 0;
	}
	console.log(`Old calculation from accumulatedMomentum: ${oldCalculation}`);

	return totalMomentum;
}

// Get momentum history for the last 30 days
export async function getMomentumHistory(
	userId: string,
	days: number = 30
): Promise<{ date: string; momentum: number }[]> {
	const db = getDb();

	// Get end date (today) and start date (n days ago)
	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(endDate.getDate() - (days - 1)); // Subtract days-1 to include today

	// Format dates properly
	const endDateStr = formatDateYYYYMMDD(endDate);
	const startDateStr = formatDateYYYYMMDD(startDate);

	console.log(`Calculating momentum history from ${startDateStr} to ${endDateStr}`);

	// inArray is now imported at module level

	// OPTIMIZATION: Pre-fetch all habits for this user once
	const [dailyHabits, weeklyHabits] = await Promise.all([
		getUserHabits(userId, 'daily'),
		getUserHabits(userId, 'weekly')
	]);

	console.log(`Found ${dailyHabits.length} daily habits and ${weeklyHabits.length} weekly habits`);

	// Get all habit IDs to use in queries
	const allHabitIds = [...dailyHabits, ...weeklyHabits].map((habit) => habit.id);

	// Early return if no habits exist
	if (allHabitIds.length === 0) {
		console.log('No habits found, returning empty momentum history');
		return [];
	}

	// FIX: Get ALL records for each habit from the beginning to properly calculate cumulative momentum
	// This ensures we include momentum accumulated before the 30-day window
	const allHabitRecords = await db
		.select()
		.from(habitRecords)
		.where(and(eq(habitRecords.userId, userId), inArray(habitRecords.habitId, allHabitIds)))
		.orderBy(habitRecords.date);

	console.log(`Found ${allHabitRecords.length} total habit records for all time`);

	// Group records by habit ID for easier processing
	const recordsByHabitId = new Map<string, HabitRecord[]>();
	allHabitIds.forEach((id) => recordsByHabitId.set(id, []));

	allHabitRecords.forEach((record) => {
		const habitRecords = recordsByHabitId.get(record.habitId) || [];
		habitRecords.push(record);
		recordsByHabitId.set(record.habitId, habitRecords);
	});

	// OPTIMIZATION: Create habit lookup map to avoid O(n²) complexity
	const habitLookup = new Map<string, Habit>();
	[...dailyHabits, ...weeklyHabits].forEach((habit) => {
		habitLookup.set(habit.id, habit);
	});

	// Debug log for habit record counts (optimized)
	allHabitIds.forEach((id) => {
		const habit = habitLookup.get(id);
		const records = recordsByHabitId.get(id) || [];
		console.log(
			`Habit "${habit?.name}" (${id}) has ${records.length} records, type: ${habit?.type}`
		);
	});

	// Create lookup for daily habit records by date
	const recordsByHabitAndDate = new Map<string, HabitRecord>();

	// Organize daily records for quick lookup
	allHabitRecords.forEach((record) => {
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
	weeklyHabits.forEach((habit) => {
		const habitRecords = recordsByHabitId.get(habit.id) || [];
		// Filter to only include records in the last 14 days that are completed
		const recentCompletedRecords = habitRecords.filter((record) => {
			return record.date >= twoWeeksAgoStr && record.completed > 0;
		});
		const completionCount = recentCompletedRecords.length;
		weeklyCompletionsByHabit.set(habit.id, completionCount);

		console.log(
			`Habit "${habit.name}" (${habit.id}) has ${completionCount} completed records in last 14 days`
		);
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

	// Build accumulated momentum progressively for each habit
	// Track accumulated momentum for each habit as we iterate through dates
	const dailyHabitAccumulated = new Map<string, number>();
	const weeklyHabitAccumulated = new Map<string, number>();

	dailyHabits.forEach((habit) => dailyHabitAccumulated.set(habit.id, 0));
	weeklyHabits.forEach((habit) => weeklyHabitAccumulated.set(habit.id, 0));

	weeklyHabits.forEach((habit) => {
		const currentAccumulated = habit.accumulatedMomentum || 0;
		weeklyHabitAccumulated.set(habit.id, currentAccumulated);
		console.log(
			`[History] Initializing weekly habit "${habit.name}" with accumulated momentum: ${currentAccumulated}`
		);
	});

	// Track which weeks we've already processed for weekly habits
	const processedWeeks = new Map<string, Set<string>>(); // habitId -> Set of week start dates
	weeklyHabits.forEach((habit) => processedWeeks.set(habit.id, new Set()));

	// Process each date
	for (const dateStr of dateArray) {
		let dailyMomentum = 0;
		let weeklyMomentum = 0;

		// ---------- DAILY HABITS ----------
		// For each daily habit, apply the delta from today's record
		for (const habit of dailyHabits) {
			const key = `${habit.id}_${dateStr}`;
			const todayRecord = recordsByHabitAndDate.get(key);

			// Only process if this record is within our date range
			if (todayRecord && todayRecord.date >= startDateStr && todayRecord.date <= endDateStr) {
				// We have a record for this date - apply the delta
				// Get previous day's record to calculate delta
				const prevDate = new Date(dateStr);
				prevDate.setDate(prevDate.getDate() - 1);
				const prevDateStr = formatDateYYYYMMDD(prevDate);
				const prevKey = `${habit.id}_${prevDateStr}`;
				const prevRecord = recordsByHabitAndDate.get(prevKey);

				const oldMomentum = prevRecord?.momentum || 0;
				const newMomentum = todayRecord.momentum || 0;
				const delta = newMomentum - oldMomentum;

				// Update accumulated momentum for this habit
				const currentAccumulated = dailyHabitAccumulated.get(habit.id) || 0;
				const newAccumulated = currentAccumulated + delta;
				dailyHabitAccumulated.set(habit.id, newAccumulated);

				console.log(
					`[History] Date ${dateStr}, habit "${habit.name}": delta=${delta}, accumulated=${newAccumulated}`
				);
			}

			// Add this habit's current accumulated momentum to the daily total
			dailyMomentum += dailyHabitAccumulated.get(habit.id) || 0;
		}

		// ---------- WEEKLY HABITS ----------
		// Get week date range for this date
		const dateObj = new Date(dateStr);
		const currentWeek = getDateRangeForWeek(dateObj);
		const weekKey = currentWeek.start; // Use week start as key

		// Process each weekly habit - only add momentum on the first day of the week we encounter
		for (const habit of weeklyHabits) {
			const habitWeeksProcessed = processedWeeks.get(habit.id)!;

			// Check if we've already processed this week for this habit AND if this week falls within our date range
			if (
				!habitWeeksProcessed.has(weekKey) &&
				currentWeek.start <= endDateStr &&
				currentWeek.end >= startDateStr
			) {
				// First time seeing this week - calculate and add its momentum
				habitWeeksProcessed.add(weekKey);

				// Calculate momentum for this week using the same logic as calculateWeeklyHabitMomentum
				const habitRecords = recordsByHabitId.get(habit.id) || [];

				// Get records for current week and previous week
				const currentWeekRecords = habitRecords.filter(
					(r) => r.date >= currentWeek.start && r.date <= currentWeek.end
				);
				const completionsThisWeek = currentWeekRecords.reduce((sum, r) => sum + r.completed, 0);

				// Get previous week
				const prevWeekEnd = new Date(currentWeek.start);
				prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
				const prevWeekStart = new Date(prevWeekEnd);
				prevWeekStart.setDate(prevWeekEnd.getDate() - 6);

				const prevWeekRecords = habitRecords.filter(
					(r) =>
						r.date >= formatDateYYYYMMDD(prevWeekStart) && r.date <= formatDateYYYYMMDD(prevWeekEnd)
				);
				const prevWeekCompletions = prevWeekRecords.reduce((sum, r) => sum + r.completed, 0);

				const targetReached = completionsThisWeek >= (habit.targetCount || 2);
				const prevWeekTargetReached = prevWeekCompletions >= (habit.targetCount || 2);

				let weekMomentum = completionsThisWeek;

				if (targetReached) {
					weekMomentum += 10;
					if (prevWeekTargetReached) {
						weekMomentum += 10; // Consecutive bonus
						weekMomentum = Math.min(weekMomentum, 40); // Cap at +40
					}
				} else if (!prevWeekTargetReached && prevWeekCompletions >= 0) {
					// Consecutive miss - calculate penalty
					// Look for records before this week to count consecutive misses
					const recordsBeforeWeek = habitRecords
						.filter((r) => r.date < currentWeek.start)
						.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

					let consecutiveMisses = 1;
					if (recordsBeforeWeek.length > 0) {
						const lastMomentum = recordsBeforeWeek[0].momentum;
						const previousPenalty = lastMomentum - prevWeekCompletions;

						if (previousPenalty === 0) {
							consecutiveMisses = 2;
						} else if (previousPenalty === -10) {
							consecutiveMisses = 3;
						} else if (previousPenalty <= -20) {
							consecutiveMisses = 4;
						}
					}

					let penalty = 0;
					if (consecutiveMisses === 2) penalty = -10;
					else if (consecutiveMisses === 3) penalty = -20;
					else if (consecutiveMisses >= 4) penalty = -30;

					weekMomentum += penalty;
				}

				// Add this week's momentum to accumulated
				const currentAccumulated = weeklyHabitAccumulated.get(habit.id) || 0;
				const newAccumulated = currentAccumulated + weekMomentum;
				weeklyHabitAccumulated.set(habit.id, newAccumulated);

				console.log(
					`[History] Week ${weekKey}, habit "${habit.name}": week momentum=${weekMomentum}, accumulated=${newAccumulated}`
				);
			}

			// Add this habit's current accumulated momentum to the total
			weeklyMomentum += weeklyHabitAccumulated.get(habit.id) || 0;
		}

		// Calculate total momentum for this day
		const totalMomentum = dailyMomentum + weeklyMomentum;

		console.log(
			`Date ${dateStr} (week ${currentWeek.start} to ${currentWeek.end}): daily=${dailyMomentum}, weekly=${weeklyMomentum}, total=${totalMomentum}`
		);

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
		console.log(
			`Preserving momentum ${previousRecord.momentum} from previous day for habit ${habitId}`
		);
		return previousRecord.momentum;
	}

	// Otherwise use the standard calculation (which will likely return 0)
	return calculateDailyHabitMomentum(habitId, userId, date, completed);
}
