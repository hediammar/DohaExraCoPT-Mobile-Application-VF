-- Fix project cascade deletion constraints
-- This script ensures that when a project is deleted, all related records are properly handled

DO $$
BEGIN
  -- Drop existing foreign key constraints if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'buildings_project_id_fkey' AND table_name = 'buildings'
  ) THEN
    ALTER TABLE buildings DROP CONSTRAINT buildings_project_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'panels_project_id_fkey' AND table_name = 'panels'
  ) THEN
    ALTER TABLE panels DROP CONSTRAINT panels_project_id_fkey;
  END IF;

END $$;

-- Recreate foreign key constraints with proper cascade behavior

-- When a project is deleted, delete all its buildings
ALTER TABLE buildings
ADD CONSTRAINT buildings_project_id_fkey
FOREIGN KEY (project_id) REFERENCES projects(id)
ON DELETE CASCADE;

-- When a project is deleted, delete all its panels
ALTER TABLE panels
ADD CONSTRAINT panels_project_id_fkey
FOREIGN KEY (project_id) REFERENCES projects(id)
ON DELETE CASCADE;

-- Note: facades don't have a direct project_id, they're linked through buildings
-- When a building is deleted, its facades are already set to CASCADE delete
-- So when a project is deleted → buildings are deleted → facades are automatically deleted

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_buildings_project_id ON buildings(project_id);
CREATE INDEX IF NOT EXISTS idx_panels_project_id ON panels(project_id);

-- Verify the constraints were created
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('buildings', 'panels')
    AND rc.unique_constraint_name LIKE '%projects_pkey%'
ORDER BY tc.table_name;
