-- Ensure ON DELETE behaviors for buildings/facades/panels
DO $$
BEGIN
  -- Drop if exists to avoid duplicate constraint errors
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'facades_building_id_fkey' AND table_name = 'facades'
  ) THEN
    ALTER TABLE facades DROP CONSTRAINT facades_building_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'panels_building_id_fkey' AND table_name = 'panels'
  ) THEN
    ALTER TABLE panels DROP CONSTRAINT panels_building_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'panels_facade_id_fkey' AND table_name = 'panels'
  ) THEN
    ALTER TABLE panels DROP CONSTRAINT panels_facade_id_fkey;
  END IF;
END $$;

-- Recreate with desired actions
-- When a building is deleted, delete its facades
ALTER TABLE facades
ADD CONSTRAINT facades_building_id_fkey
FOREIGN KEY (building_id) REFERENCES buildings(id)
ON DELETE CASCADE;

-- When a building is deleted, set building_id in panels to NULL
ALTER TABLE panels
ADD CONSTRAINT panels_building_id_fkey
FOREIGN KEY (building_id) REFERENCES buildings(id)
ON DELETE SET NULL;

-- When a facade is deleted, set facade_id in panels to NULL
ALTER TABLE panels
ADD CONSTRAINT panels_facade_id_fkey
FOREIGN KEY (facade_id) REFERENCES facades(id)
ON DELETE SET NULL;
