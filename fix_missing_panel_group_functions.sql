-- Fix missing panel group functions
-- This script adds the missing create_panel_group and update_panel_group functions
-- that are needed for the frontend to work properly with the many-to-many migration

-- Create the create_panel_group function (missing from original migration)
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

-- Create the update_panel_group function (also missing from original migration)
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

-- Verify the functions were created successfully
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('create_panel_group', 'update_panel_group')
AND routine_schema = 'public'
ORDER BY routine_name;
