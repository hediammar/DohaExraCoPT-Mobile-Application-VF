-- Fix RLS policies for scan_history table to work with custom auth system
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can insert their own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can update their own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can delete their own scan history" ON scan_history;

-- Create a function to validate user_id exists in users table
CREATE OR REPLACE FUNCTION user_exists(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(SELECT 1 FROM public.users WHERE id = user_uuid AND status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies that work with custom auth but maintain security
-- Users can view their own scan history (validate user_id exists and is active)
CREATE POLICY "Users can view their own scan history" ON scan_history
    FOR SELECT USING (user_exists(user_id));

-- Users can insert their own scan history (validate user_id exists and is active)
CREATE POLICY "Users can insert their own scan history" ON scan_history
    FOR INSERT WITH CHECK (user_exists(user_id));

-- Users can update their own scan history (validate user_id exists and is active)
CREATE POLICY "Users can update their own scan history" ON scan_history
    FOR UPDATE USING (user_exists(user_id));

-- Users can delete their own scan history (validate user_id exists and is active)
CREATE POLICY "Users can delete their own scan history" ON scan_history
    FOR DELETE USING (user_exists(user_id));

-- Grant execute permission on the validation function
GRANT EXECUTE ON FUNCTION user_exists(UUID) TO authenticated;
