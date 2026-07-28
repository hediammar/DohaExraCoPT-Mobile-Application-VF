-- Fix panel deletion and disable triggers to prevent duplicate status history entries

-- 1. First, let's check the current triggers on the panels table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'panels' 
AND trigger_name LIKE '%status%';

-- 2. Disable the triggers that create duplicate status history entries
-- (Replace with actual trigger names from the query above)
DROP TRIGGER IF EXISTS panel_status_insert_trigger ON panels;
DROP TRIGGER IF EXISTS panel_status_update_trigger ON panels;

-- 3. Verify the foreign key constraint for CASCADE deletion
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'panel_status_histories'
AND kcu.column_name = 'panel_id';

-- 4. Test the CASCADE deletion (optional - for verification)
-- This will show you what would be deleted if you delete a panel
-- Replace 'your_panel_id' with an actual panel ID
/*
SELECT 
    p.id as panel_id,
    p.name as panel_name,
    COUNT(psh.id) as history_count
FROM panels p
LEFT JOIN panel_status_histories psh ON p.id = psh.panel_id
WHERE p.id = 'your_panel_id'
GROUP BY p.id, p.name;
*/

-- 5. If you need to recreate the CASCADE constraint (shouldn't be needed)
-- ALTER TABLE panel_status_histories 
-- DROP CONSTRAINT IF EXISTS panel_status_histories_panel_id_fkey;
-- 
-- ALTER TABLE panel_status_histories 
-- ADD CONSTRAINT panel_status_histories_panel_id_fkey 
-- FOREIGN KEY (panel_id) REFERENCES panels (id) ON DELETE CASCADE;
