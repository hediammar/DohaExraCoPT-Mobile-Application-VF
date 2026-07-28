-- Fix for panel delete trigger causing 409 Conflict error
-- The issue is that the log_panel_status_change trigger is trying to insert into panel_status_histories
-- during DELETE operations, which causes a conflict

-- Drop the existing triggers
DROP TRIGGER IF EXISTS panel_status_update ON panels;
DROP TRIGGER IF EXISTS panel_status_trigger ON panels;

-- Create a new improved trigger function that only handles INSERT and UPDATE
CREATE OR REPLACE FUNCTION log_panel_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Only proceed for INSERT and UPDATE operations, not DELETE
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    -- Get the current user ID from the panel record
    current_user_id := NEW.user_id;
    
    -- Log the operation for debugging
    RAISE NOTICE 'Panel status change: panel_id=%, status=%, user_id=%, operation=%', NEW.id, NEW.status, current_user_id, TG_OP;
    
    -- Insert status history with user tracking
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
    
    -- Log the inserted record
    RAISE NOTICE 'Status history inserted: panel_id=%, status=%, user_id=%', NEW.id, NEW.status, COALESCE(current_user_id, (SELECT id FROM users WHERE username = 'admin' LIMIT 1));
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Error in log_panel_status_change: %', SQLERRM;
        RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the triggers only for INSERT and UPDATE operations
CREATE TRIGGER panel_status_update
    AFTER UPDATE OF status ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

CREATE TRIGGER panel_status_trigger
    AFTER INSERT ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

-- Verify the triggers are properly set up
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'panels' 
ORDER BY trigger_name; 