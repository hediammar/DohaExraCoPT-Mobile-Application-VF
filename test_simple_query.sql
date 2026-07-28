-- Test 1: Simple count query
SELECT COUNT(*) as total_panels FROM public.panels;

-- Test 2: Simple select with limit
SELECT id, name FROM public.panels LIMIT 5;

-- Test 3: Select with range
SELECT id, name FROM public.panels ORDER BY created_at LIMIT 1000;

-- Test 4: Check if there's a created_at column (if not, use id for ordering)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'panels' AND table_schema = 'public';

-- Test 5: Try to fetch all panels with a simple query
SELECT COUNT(*) FROM (
    SELECT id FROM public.panels
) as subquery;

-- Test 6: Check if there are any constraints or triggers that might be causing issues
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'panels';
