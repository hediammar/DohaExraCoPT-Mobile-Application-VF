-- Robust fix for project cascade deletion
-- This script handles all edge cases and existing constraints

-- First, let's see what foreign key constraints exist
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE '=== CURRENT FOREIGN KEY CONSTRAINTS REFERENCING PROJECTS ===';
    
    FOR constraint_record IN 
        SELECT 
            tc.table_name,
            kcu.column_name,
            tc.constraint_name,
            rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND rc.unique_constraint_name LIKE '%projects_pkey%'
        ORDER BY tc.table_name, kcu.column_name
    LOOP
        RAISE NOTICE 'Table: %, Column: %, Constraint: %, Delete Rule: %', 
            constraint_record.table_name, 
            constraint_record.column_name, 
            constraint_record.constraint_name, 
            constraint_record.delete_rule;
    END LOOP;
END $$;

-- Drop ALL existing foreign key constraints that reference projects
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE '=== DROPPING EXISTING FOREIGN KEY CONSTRAINTS ===';
    
    FOR constraint_record IN 
        SELECT 
            tc.table_name,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND rc.unique_constraint_name LIKE '%projects_pkey%'
    LOOP
        RAISE NOTICE 'Dropping constraint % on table %', constraint_record.constraint_name, constraint_record.table_name;
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', constraint_record.table_name, constraint_record.constraint_name);
    END LOOP;
END $$;

-- Recreate foreign key constraints with CASCADE DELETE for all tables that have project_id
DO $$
DECLARE
    table_record RECORD;
    constraint_name TEXT;
BEGIN
    RAISE NOTICE '=== RECREATING FOREIGN KEY CONSTRAINTS WITH CASCADE ===';
    
    -- Check all tables that have a project_id column
    FOR table_record IN 
        SELECT 
            table_name,
            column_name
        FROM information_schema.columns 
        WHERE column_name = 'project_id'
            AND table_schema = 'public'
            AND table_name != 'projects'
    LOOP
        -- Check if table actually exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = table_record.table_name 
            AND table_schema = 'public'
        ) THEN
            -- Drop any existing constraint with the same name to avoid conflicts
            constraint_name := table_record.table_name || '_project_id_fkey';
            
            BEGIN
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                    table_record.table_name, constraint_name);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop constraint % on table %: %', constraint_name, table_record.table_name, SQLERRM;
            END;
            
            -- Create the new constraint
            BEGIN
                RAISE NOTICE 'Adding CASCADE constraint to %.%', table_record.table_name, table_record.column_name;
                EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE', 
                    table_record.table_name, constraint_name);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create constraint on table %: %', table_record.table_name, SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'Table % does not exist, skipping', table_record.table_name;
        END IF;
    END LOOP;
END $$;

-- Create indexes for better performance
DO $$
DECLARE
    table_record RECORD;
BEGIN
    RAISE NOTICE '=== CREATING INDEXES ===';
    
    FOR table_record IN 
        SELECT table_name
        FROM information_schema.columns 
        WHERE column_name = 'project_id'
            AND table_schema = 'public'
            AND table_name != 'projects'
    LOOP
        -- Check if table actually exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = table_record.table_name 
            AND table_schema = 'public'
        ) THEN
            BEGIN
                RAISE NOTICE 'Creating index on %.project_id', table_record.table_name;
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_project_id ON %I(project_id)', 
                    table_record.table_name, table_record.table_name);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create index on table %: %', table_record.table_name, SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'Table % does not exist, skipping index creation', table_record.table_name;
        END IF;
    END LOOP;
END $$;

-- Verify the new constraints
SELECT 
    tc.table_name, 
    kcu.column_name,
    tc.constraint_name, 
    tc.constraint_type,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND rc.unique_constraint_name LIKE '%projects_pkey%'
ORDER BY tc.table_name, kcu.column_name;
