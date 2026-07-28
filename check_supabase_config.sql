-- Check if RLS is enabled on panels table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'panels';

-- Check RLS policies on panels table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'panels';

-- Check if there are any policies that might limit results
SELECT * FROM pg_policies WHERE tablename = 'panels';

-- Check the current user and their permissions
SELECT current_user, session_user;

-- Check if there are any views or functions that might be limiting results
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE viewname LIKE '%panel%';

-- Check for any functions that might be used in policies
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%panel%' OR prosrc LIKE '%panel%';
