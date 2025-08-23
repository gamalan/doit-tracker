-- Performance optimization migration
-- Add database indexes for habit tracking queries
-- Run after initial schema migration

-- Note: The following indexes already exist in migrations.sql:
-- - habit_records_habit_date_idx (UNIQUE) on (habit_id, date) 
-- - habit_records_user_id_idx on (user_id)
-- - habit_records_date_idx on (date)

-- Additional composite index for efficient user+habit filtering
-- Optimizes: getUserTotalMomentum, habit-specific queries
CREATE INDEX IF NOT EXISTS idx_habit_records_user_habit ON habit_records(user_id, habit_id);