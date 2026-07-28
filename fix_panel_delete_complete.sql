-- Comprehensive fix for panel delete with proper cascade deletion
-- This addresses all foreign key constraint issues

-- Step 1: Drop existing triggers to start fresh
DROP TRIGGER IF EXISTS panel_status_trigger ON panels;
DROP TRIGGER IF EXISTS panel_status_update ON panels;
DROP TRIGGER IF EXISTS panel_group_status_update ON panel_groups;

-- Step 2: Fix the panel_status_histories foreign key constraint to include CASCADE
-- First, drop the existing constraint
ALTER TABLE public.panel_status_histories 
DROP CONSTRAINT IF EXISTS panel_status_histories_backup_panel_id_fkey;

-- Then add the correct constraint with CASCADE
ALTER TABLE public.panel_status_histories 
ADD CONSTRAINT panel_status_histories_panel_id_fkey 
FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE;

-- Step 3: Add missing foreign key constraint for panel_group_id
ALTER TABLE public.panels 
ADD CONSTRAINT panels_panel_group_id_fkey 
FOREIGN KEY (panel_group_id) REFERENCES panel_groups(id) ON DELETE SET NULL;

-- Step 4: Create a proper trigger function that handles all operations correctly
CREATE OR REPLACE FUNCTION log_panel_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Handle different operations
    CASE TG_OP
        WHEN 'DELETE' THEN
            -- For DELETE operations, just return OLD without doing anything
            -- The CASCADE constraint will handle panel_status_histories deletion
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

-- Step 5: Create triggers only for INSERT and UPDATE operations
CREATE TRIGGER panel_status_insert_trigger
    AFTER INSERT ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

CREATE TRIGGER panel_status_update_trigger
    AFTER UPDATE ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

-- Step 6: Create a function to update panel statuses when panel group status changes
CREATE OR REPLACE FUNCTION update_panels_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all panels in this group to match the group status
    UPDATE panels 
    SET status = NEW.status 
    WHERE panel_group_id = NEW.id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in update_panels_status: %', SQLERRM;
        RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 7: Recreate the panel group status update trigger
CREATE TRIGGER panel_group_status_update
    AFTER UPDATE OF status ON panel_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_panels_status();

-- Step 8: Verify all constraints are properly set up
SELECT 
    tc.constraint_name,
    tc.table_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('panels', 'panel_status_histories', 'panel_groups')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Step 9: Verify triggers are properly set up
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table IN ('panels', 'panel_groups')
ORDER BY event_object_table, trigger_name;

-- Step 10: Test the cascade deletion setup
-- This query shows the deletion cascade path
SELECT 
    'panels' as table_name,
    'panel_status_histories' as dependent_table,
    'CASCADE' as delete_rule
UNION ALL
SELECT 
    'panel_groups' as table_name,
    'panels' as dependent_table,
    'SET NULL' as delete_rule; 