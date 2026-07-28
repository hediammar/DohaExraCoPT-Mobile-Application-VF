-- Disable the trigger that automatically creates panel status history records
-- This is needed because we now handle history creation manually with custom dates

-- First, let's check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'panels' 
AND trigger_name LIKE '%status%';

-- Disable the trigger (replace 'trigger_name' with the actual trigger name from above)
-- DROP TRIGGER IF EXISTS [trigger_name] ON panels;

-- Alternative: If you want to keep the trigger but disable it temporarily
-- ALTER TABLE panels DISABLE TRIGGER [trigger_name];

-- To re-enable later (if needed):
-- ALTER TABLE panels ENABLE TRIGGER [trigger_name];
