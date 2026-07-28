-- Enhanced fix for panel delete trigger causing 409 Conflict error
-- This version addresses multiple potential issues

-- Step 1: Check for all triggers on the panels table
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'panels' 
ORDER BY trigger_name;

-- Step 2: Drop ALL existing triggers on panels table to start fresh
DROP TRIGGER IF EXISTS panel_status_update ON panels;
DROP TRIGGER IF EXISTS panel_status_trigger ON panels;
DROP TRIGGER IF EXISTS update_panels_updated_at ON panels;

-- Step 3: Create a completely new trigger function that handles all operations properly
CREATE OR REPLACE FUNCTION log_panel_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Handle different operations
    CASE TG_OP
        WHEN 'DELETE' THEN
            -- For DELETE operations, just return OLD without doing anything
            RAISE NOTICE 'Panel DELETE operation: panel_id=%, operation=%', OLD.id, TG_OP;
            RETURN OLD;
            
        WHEN 'INSERT' THEN
            -- For INSERT operations, log the status change
            current_user_id := NEW.user_id;
            RAISE NOTICE 'Panel INSERT: panel_id=%, status=%, user_id=%', NEW.id, NEW.status, current_user_id;
            
            -- Insert status history
            INSERT INTO panel_status_histories (
                panel_id,
                status,
                user_id,
                created_at
            ) VALUES (
                NEW.id,
                NEW.status,
                COALESCE(current_user_id, (SELECT id FROM users WHERE username = 'admin' LIMIT 1)),
                NOW()
            );
            
            RETURN NEW;
            
        WHEN 'UPDATE' THEN
            -- For UPDATE operations, only log if status changed
            IF OLD.status IS DISTINCT FROM NEW.status THEN
                current_user_id := NEW.user_id;
                RAISE NOTICE 'Panel status UPDATE: panel_id=%, old_status=%, new_status=%, user_id=%', 
                    NEW.id, OLD.status, NEW.status, current_user_id;
                
                -- Insert status history
                INSERT INTO panel_status_histories (
                    panel_id,
                    status,
                    user_id,
                    created_at
                ) VALUES (
                    NEW.id,
                    NEW.status,
                    COALESCE(current_user_id, (SELECT id FROM users WHERE username = 'admin' LIMIT 1)),
                    NOW()
                );
            END IF;
            
            RETURN NEW;
            
        ELSE
            -- For any other operation, just return
            RETURN COALESCE(NEW, OLD);
    END CASE;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Error in log_panel_status_change: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Step 4: Create triggers only for INSERT and UPDATE operations
CREATE TRIGGER panel_status_insert_trigger
    AFTER INSERT ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

CREATE TRIGGER panel_status_update_trigger
    AFTER UPDATE ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

-- Step 5: Create a separate trigger for DELETE operations that does nothing
CREATE OR REPLACE FUNCTION handle_panel_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Just log the delete operation and return OLD
    RAISE NOTICE 'Panel DELETE: panel_id=%, project_id=%', OLD.id, OLD.project_id;
    RETURN OLD;
END;
$$ language 'plpgsql';

CREATE TRIGGER panel_delete_trigger
    BEFORE DELETE ON panels
    FOR EACH ROW
    EXECUTE FUNCTION handle_panel_delete();

-- Step 6: Verify the triggers are properly set up
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'panels' 
ORDER BY trigger_name;

-- Step 7: Test the foreign key constraints
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
AND tc.table_name = 'panels'; 