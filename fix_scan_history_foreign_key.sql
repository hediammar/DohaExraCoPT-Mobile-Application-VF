-- Fix foreign key constraint for scan_history table
-- The current constraint references auth.users but we're using a custom users table

-- First, drop the existing foreign key constraint
ALTER TABLE scan_history DROP CONSTRAINT IF EXISTS scan_history_user_id_fkey;

-- Add new foreign key constraint to reference the custom users table
ALTER TABLE scan_history ADD CONSTRAINT scan_history_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Verify the constraint was added correctly
-- You can check this by running: \d scan_history in psql or checking the table structure in Supabase
