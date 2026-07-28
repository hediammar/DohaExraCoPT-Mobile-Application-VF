-- Check if RLS is enabled and what policies exist
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    (SELECT count(*) FROM pg_policies WHERE tablename = 'panels') as policy_count
FROM pg_tables 
WHERE tablename = 'panels';

-- Show all policies on panels table
SELECT 
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'panels';

-- Check current user context
SELECT 
    current_user,
    session_user,
    current_setting('role') as current_role;