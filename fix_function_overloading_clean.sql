-- Fix function overloading issue for create_panel_group
-- This script drops all existing create_panel_group functions and recreates the correct one

-- First, drop all existing create_panel_group functions to resolve overloading
DROP FUNCTION IF EXISTS create_panel_group(VARCHAR(100), TEXT);
DROP FUNCTION IF EXISTS create_panel_group(VARCHAR(100), TEXT, INTEGER);
DROP FUNCTION IF EXISTS create_panel_group(VARCHAR(100));
DROP FUNCTION IF EXISTS create_panel_group(VARCHAR(100), INTEGER);
DROP FUNCTION IF EXISTS create_panel_group(VARCHAR(100), TEXT, VARCHAR(100));

-- Also drop any related functions that might be causing conflicts
DROP FUNCTION IF EXISTS create_panel_group_from_panels(UUID[], VARCHAR(100), TEXT);
DROP FUNCTION IF EXISTS create_panel_group_from_panels(UUID[], VARCHAR(100), TEXT, INTEGER);

-- Now create the correct create_panel_group function for the many-to-many relationship
CREATE OR REPLACE FUNCTION create_panel_group(
  group_name VARCHAR(100),
  group_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_group_id UUID;
BEGIN
  -- Insert new panel group
  INSERT INTO public.panel_groups (name, description)
  VALUES (group_name, group_description)
  RETURNING id INTO new_group_id;
  
  RETURN new_group_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating panel group: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the update_panel_group function
CREATE OR REPLACE FUNCTION update_panel_group(
  group_id UUID,
  group_name VARCHAR(100),
  group_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the panel group
  UPDATE public.panel_groups 
  SET name = group_name, 
      description = group_description,
      updated_at = NOW()
  WHERE id = group_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error updating panel group: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create the create_panel_group_from_panels function
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
  
  -- Add panels to the group using the many-to-many relationship
  PERFORM add_panels_to_group(new_group_id, panel_ids);
  
  RETURN new_group_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating panel group from panels: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Verify the functions were created successfully
SELECT 
    r.routine_name,
    r.routine_type,
    r.data_type,
    p.parameter_name,
    p.parameter_mode,
    p.parameter_default
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_name IN ('create_panel_group', 'update_panel_group', 'create_panel_group_from_panels')
AND r.routine_schema = 'public'
ORDER BY r.routine_name, p.ordinal_position;
