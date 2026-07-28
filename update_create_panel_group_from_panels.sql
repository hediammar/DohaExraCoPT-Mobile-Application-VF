-- Update create_panel_group_from_panels function to accept project_id
DROP FUNCTION IF EXISTS create_panel_group_from_panels(uuid[], character varying, text);

CREATE OR REPLACE FUNCTION create_panel_group_from_panels(
  panel_ids UUID[],
  name VARCHAR(100),
  description TEXT DEFAULT NULL,
  project_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_group_id UUID;
BEGIN
  -- Create the panel group first with project_id
  SELECT create_panel_group(name, description, project_id) INTO new_group_id;
  
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
