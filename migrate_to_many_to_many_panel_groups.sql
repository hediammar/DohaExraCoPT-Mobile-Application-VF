-- Migration script to change panel-group relationship from one-to-many to many-to-many
-- This script creates a junction table and updates all related functions

-- Step 1: Create the junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.panel_group_memberships (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    panel_id UUID NOT NULL,
    panel_group_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT panel_group_memberships_pkey PRIMARY KEY (id),
    CONSTRAINT panel_group_memberships_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE,
    CONSTRAINT panel_group_memberships_panel_group_id_fkey FOREIGN KEY (panel_group_id) REFERENCES panel_groups(id) ON DELETE CASCADE,
    CONSTRAINT panel_group_memberships_unique UNIQUE (panel_id, panel_group_id)
) TABLESPACE pg_default;

-- Step 2: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_panel_group_memberships_panel_id ON public.panel_group_memberships USING btree (panel_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_panel_group_memberships_panel_group_id ON public.panel_group_memberships USING btree (panel_group_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_panel_group_memberships_created_at ON public.panel_group_memberships USING btree (created_at) TABLESPACE pg_default;

-- Step 3: Migrate existing data from panel_group_id to the junction table
INSERT INTO public.panel_group_memberships (panel_id, panel_group_id)
SELECT id, panel_group_id 
FROM public.panels 
WHERE panel_group_id IS NOT NULL
ON CONFLICT (panel_id, panel_group_id) DO NOTHING;

-- Step 4: Drop the old panel_group_id column and its constraints
-- First drop the foreign key constraint
ALTER TABLE public.panels DROP CONSTRAINT IF EXISTS panels_panel_group_id_fkey;

-- Then drop the index
DROP INDEX IF EXISTS idx_panels_panel_group_id;

-- Finally drop the column
ALTER TABLE public.panels DROP COLUMN IF EXISTS panel_group_id;

-- Step 5: Update the add_panels_to_group function for many-to-many relationship
CREATE OR REPLACE FUNCTION add_panels_to_group(
  group_id UUID,
  panel_ids UUID[]
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Insert panels into the junction table (many-to-many)
  INSERT INTO public.panel_group_memberships (panel_id, panel_group_id)
  SELECT panel_id, group_id
  FROM unnest(panel_ids) AS panel_id
  ON CONFLICT (panel_id, panel_group_id) DO NOTHING; -- Ignore duplicates
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error adding panels to group: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 5.5: Create the create_panel_group function (missing from original migration)
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

-- Step 5.6: Create the update_panel_group function (also missing from original migration)
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

-- Step 6: Update the delete_panel_group function
CREATE OR REPLACE FUNCTION delete_panel_group(
  group_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Delete the panel group (cascade will remove memberships)
  DELETE FROM public.panel_groups 
  WHERE id = group_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error deleting panel group: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create a function to remove panels from a group
CREATE OR REPLACE FUNCTION remove_panels_from_group(
  group_id UUID,
  panel_ids UUID[]
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Remove panels from the group
  DELETE FROM public.panel_group_memberships
  WHERE panel_group_id = group_id 
  AND panel_id = ANY(panel_ids);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error removing panels from group: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create a function to get all panels in a group
CREATE OR REPLACE FUNCTION get_panels_in_group(
  group_id UUID
)
RETURNS TABLE (
  panel_id UUID,
  panel_name VARCHAR,
  panel_status INTEGER,
  panel_tag VARCHAR,
  drawing_number VARCHAR,
  unit_qty INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.status,
    p.issue_transmittal_no,
    p.drawing_number,
    p.ifp_qty_nos
  FROM public.panels p
  INNER JOIN public.panel_group_memberships pgm ON p.id = pgm.panel_id
  WHERE pgm.panel_group_id = group_id;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create a function to get all groups for a panel
CREATE OR REPLACE FUNCTION get_panel_groups(
  panel_id UUID
)
RETURNS TABLE (
  group_id UUID,
  group_name VARCHAR,
  group_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg.id,
    pg.name,
    pg.description,
    pg.created_at
  FROM public.panel_groups pg
  INNER JOIN public.panel_group_memberships pgm ON pg.id = pgm.panel_group_id
  WHERE pgm.panel_id = panel_id;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create a function to check if a panel is in a group
CREATE OR REPLACE FUNCTION is_panel_in_group(
  panel_id UUID,
  group_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.panel_group_memberships 
    WHERE panel_id = $1 AND panel_group_id = $2
  );
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create a function to get panel count for a group
CREATE OR REPLACE FUNCTION get_panel_group_count(
  group_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) 
    FROM public.panel_group_memberships 
    WHERE panel_group_id = group_id
  );
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create a function to get available panels (not in any group)
CREATE OR REPLACE FUNCTION get_available_panels()
RETURNS TABLE (
  panel_id UUID,
  panel_name VARCHAR,
  panel_status INTEGER,
  panel_tag VARCHAR,
  drawing_number VARCHAR,
  unit_qty INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.status,
    p.issue_transmittal_no,
    p.drawing_number,
    p.ifp_qty_nos
  FROM public.panels p
  WHERE NOT EXISTS (
    SELECT 1 
    FROM public.panel_group_memberships pgm 
    WHERE pgm.panel_id = p.id
  );
END;
$$ LANGUAGE plpgsql;

-- Step 13: Create a function to get panels not in a specific group
CREATE OR REPLACE FUNCTION get_panels_not_in_group(
  group_id UUID
)
RETURNS TABLE (
  panel_id UUID,
  panel_name VARCHAR,
  panel_status INTEGER,
  panel_tag VARCHAR,
  drawing_number VARCHAR,
  unit_qty INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.status,
    p.issue_transmittal_no,
    p.drawing_number,
    p.ifp_qty_nos
  FROM public.panels p
  WHERE NOT EXISTS (
    SELECT 1 
    FROM public.panel_group_memberships pgm 
    WHERE pgm.panel_id = p.id AND pgm.panel_group_id = group_id
  );
END;
$$ LANGUAGE plpgsql;

-- Step 14: Verify the migration
SELECT 
    'Migration completed successfully' as status,
    (SELECT COUNT(*) FROM public.panel_group_memberships) as memberships_count,
    (SELECT COUNT(*) FROM public.panel_groups) as groups_count,
    (SELECT COUNT(*) FROM public.panels) as panels_count;

-- Step 15: Show sample data to verify the migration
SELECT 
    'Sample panel group memberships:' as info,
    pgm.panel_id,
    pgm.panel_group_id,
    p.name as panel_name,
    pg.name as group_name
FROM public.panel_group_memberships pgm
JOIN public.panels p ON pgm.panel_id = p.id
JOIN public.panel_groups pg ON pgm.panel_group_id = pg.id
LIMIT 5;
