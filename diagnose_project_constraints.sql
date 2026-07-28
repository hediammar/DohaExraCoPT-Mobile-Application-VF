-- Diagnostic script to identify all foreign key constraints referencing projects
-- This will help us understand what's preventing project deletion

-- Check all foreign key constraints that reference the projects table
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND rc.unique_constraint_name LIKE '%projects_pkey%'
ORDER BY tc.table_name, kcu.column_name;

-- Check if there are any records in related tables for a specific project
-- Replace '94ca5f5d-3396-4cdb-b24a-2bc7ffd5bd50' with the actual project ID you're trying to delete
SELECT 'buildings' as table_name, COUNT(*) as record_count
FROM buildings 
WHERE project_id = '94ca5f5d-3396-4cdb-b24a-2bc7ffd5bd50'
UNION ALL
SELECT 'panels' as table_name, COUNT(*) as record_count
FROM panels 
WHERE project_id = '94ca5f5d-3396-4cdb-b24a-2bc7ffd5bd50'
UNION ALL
SELECT 'facades' as table_name, COUNT(*) as record_count
FROM facades f
JOIN buildings b ON f.building_id = b.id
WHERE b.project_id = '94ca5f5d-3396-4cdb-b24a-2bc7ffd5bd50';

-- Check for any other tables that might have project_id columns
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name LIKE '%project%'
    AND table_schema = 'public'
ORDER BY table_name, column_name;

-- Check for any triggers that might be preventing deletion
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'projects'
ORDER BY trigger_name;
