-- Add panel_group_id column to panels table
ALTER TABLE public.panels ADD COLUMN IF NOT EXISTS panel_group_id UUID NULL;

-- Drop the constraint if it exists (to avoid errors)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'panels_panel_group_id_fkey' 
        AND table_name = 'panels'
    ) THEN
        ALTER TABLE public.panels DROP CONSTRAINT panels_panel_group_id_fkey;
    END IF;
END $$;

-- Add foreign key constraint to panel_groups table
ALTER TABLE public.panels 
ADD CONSTRAINT panels_panel_group_id_fkey 
FOREIGN KEY (panel_group_id) REFERENCES panel_groups(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_panels_panel_group_id ON public.panels USING btree (panel_group_id) TABLESPACE pg_default;

-- Drop the trigger if it exists (since we're removing status)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'panel_group_status_update'
        AND event_object_table = 'panel_groups'
    ) THEN
        DROP TRIGGER IF EXISTS panel_group_status_update ON public.panel_groups;
    END IF;
END $$;

-- Remove status column from panel_groups table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'panel_groups' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.panel_groups DROP COLUMN status;
    END IF;
END $$;

-- Create function to add panels to a group
CREATE OR REPLACE FUNCTION add_panels_to_group(
  group_id UUID,
  panel_ids UUID[]
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update panels to assign them to the group
  UPDATE public.panels 
  SET panel_group_id = group_id
  WHERE id = ANY(panel_ids);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error adding panels to group: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create function to create a new panel group
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

-- Create function to create a panel group from selected panels
-- First drop the existing function to allow parameter name changes
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

-- Create function to update a panel group
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

-- Create function to delete a panel group
CREATE OR REPLACE FUNCTION delete_panel_group(
  group_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- First, remove all panels from the group (set panel_group_id to NULL)
  UPDATE public.panels 
  SET panel_group_id = NULL
  WHERE panel_group_id = group_id;
  
  -- Then delete the panel group
  DELETE FROM public.panel_groups 
  WHERE id = group_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error deleting panel group: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
