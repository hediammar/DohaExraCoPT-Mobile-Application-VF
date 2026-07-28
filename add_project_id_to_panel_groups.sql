-- Add project_id column to panel_groups table
ALTER TABLE panel_groups ADD COLUMN project_id UUID REFERENCES projects(id);

-- Update the create_panel_group function to accept project_id
CREATE OR REPLACE FUNCTION create_panel_group(
  group_name TEXT,
  group_description TEXT DEFAULT NULL,
  project_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_group_id UUID;
BEGIN
  -- Insert the new panel group
  INSERT INTO panel_groups (name, description, project_id)
  VALUES (group_name, group_description, project_id)
  RETURNING id INTO new_group_id;
  
  RETURN new_group_id;
END;
$$;

-- Update the update_panel_group function to accept project_id
CREATE OR REPLACE FUNCTION update_panel_group(
  group_id UUID,
  group_name TEXT,
  group_description TEXT DEFAULT NULL,
  project_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE panel_groups 
  SET 
    name = group_name,
    description = group_description,
    project_id = COALESCE(project_id, panel_groups.project_id)
  WHERE id = group_id;
END;
$$;
