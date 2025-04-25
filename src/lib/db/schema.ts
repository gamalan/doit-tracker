import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, blob, unique } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
});

// Habits table
export const habits = sqliteTable('habits', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', { enum: ['daily', 'weekly'] }).notNull(),
  targetCount: integer('target_count').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  archivedAt: integer('archived_at', { mode: 'timestamp' })
});

// Habit tracking records
export const habitRecords = sqliteTable('habit_records', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  habitId: text('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // Stored as YYYY-MM-DD
  completed: integer('completed').notNull().default(0),
  momentum: integer('momentum').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    habitDateIdx: unique('habit_records_habit_date_idx').on(table.habitId, table.date)
  };
});