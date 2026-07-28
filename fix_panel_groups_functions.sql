-- Fix panel groups functions
-- This script updates the functions to work with the current database schema

-- First, drop the existing function to allow parameter name changes
DROP FUNCTION IF EXISTS create_panel_group_from_panels(uuid[], character varying, text);

-- Now create the function with the correct parameter names
CREATE OR REPLACE FUNCTION create_panel_group_from_panels(
  panel_ids UUID[],
  name VARCHAR(100),
  description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_group_id UUID;
BEGIN
  -- Create the panel group first
  SELECT create_panel_group(name, description) INTO new_group_id;
  
  IF new_group_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create panel group';
  END IF;
  
  -- Add panels to the group
  PERFORM add_panels_to_group(new_group_id, panel_ids);
  
  RETURN new_group_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating panel group from panels: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was created successfully
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'create_panel_group_from_panels'
AND routine_schema = 'public';

-- Test the function (optional - uncomment to test)
-- SELECT create_panel_group_from_panels(ARRAY[]::UUID[], 'Test Group', 'Test Description');
