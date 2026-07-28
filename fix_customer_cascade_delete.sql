-- Fix customer cascade delete constraints
-- This script adds proper foreign key constraints to handle customer deletion correctly

-- First, let's check if the constraints already exist and drop them if needed
DO $$ 
BEGIN
    -- Drop existing foreign key constraints if they exist
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customers_user_id_fkey' 
        AND table_name = 'customers'
    ) THEN
        ALTER TABLE customers DROP CONSTRAINT customers_user_id_fkey;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_customer_id_fkey' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_customer_id_fkey;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_customer_id_fkey' 
        AND table_name = 'projects'
    ) THEN
        ALTER TABLE projects DROP CONSTRAINT projects_customer_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'buildings_user_id_fkey' 
        AND table_name = 'buildings'
    ) THEN
        ALTER TABLE buildings DROP CONSTRAINT buildings_user_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'panel_status_histories_user_id_fkey' 
        AND table_name = 'panel_status_histories'
    ) THEN
        ALTER TABLE panel_status_histories DROP CONSTRAINT panel_status_histories_user_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'panels_user_id_fkey' 
        AND table_name = 'panels'
    ) THEN
        ALTER TABLE panels DROP CONSTRAINT panels_user_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'facades_user_id_fkey' 
        AND table_name = 'facades'
    ) THEN
        ALTER TABLE facades DROP CONSTRAINT facades_user_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_user_id_fkey' 
        AND table_name = 'projects'
    ) THEN
        ALTER TABLE projects DROP CONSTRAINT projects_user_id_fkey;
    END IF;
END $$;

-- Add foreign key constraints with proper cascade behavior

-- 1. Customer's user_id references users.id with CASCADE DELETE
-- When a user is deleted, the customer's user_id will be set to NULL
ALTER TABLE customers 
ADD CONSTRAINT customers_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE SET NULL;

-- 2. User's customer_id references customers.id with CASCADE DELETE
-- When a customer is deleted, the user's customer_id will be set to NULL
ALTER TABLE users 
ADD CONSTRAINT users_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) 
ON DELETE SET NULL;

       -- 3. Project's customer_id references customers.id with CASCADE DELETE
       -- When a customer is deleted, the project's customer_id will be set to NULL
       ALTER TABLE projects
       ADD CONSTRAINT projects_customer_id_fkey
       FOREIGN KEY (customer_id) REFERENCES customers(id)
       ON DELETE SET NULL;

               -- 4. Building's user_id references users.id with CASCADE DELETE
        -- When a user is deleted, the building's user_id will be set to NULL
        ALTER TABLE buildings
        ADD CONSTRAINT buildings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL;

        -- 5. Panel status histories user_id references users.id with CASCADE DELETE
        -- When a user is deleted, the panel_status_histories user_id will be set to NULL
        ALTER TABLE panel_status_histories
        ADD CONSTRAINT panel_status_histories_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL;

        -- 6. Panels user_id references users.id with CASCADE DELETE
        -- When a user is deleted, the panels user_id will be set to NULL
        ALTER TABLE panels
        ADD CONSTRAINT panels_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL;

        -- 7. Facades user_id references users.id with CASCADE DELETE
-- When a user is deleted, the facades user_id will be set to NULL
ALTER TABLE facades
ADD CONSTRAINT facades_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE SET NULL;

-- 8. Projects user_id references users.id with CASCADE DELETE
-- When a user is deleted, the projects user_id will be set to NULL
ALTER TABLE projects
ADD CONSTRAINT projects_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_buildings_user_id ON buildings(user_id);
CREATE INDEX IF NOT EXISTS idx_panel_status_histories_user_id ON panel_status_histories(user_id);
CREATE INDEX IF NOT EXISTS idx_panels_user_id ON panels(user_id);
CREATE INDEX IF NOT EXISTS idx_facades_user_id ON facades(user_id);

-- Verify the constraints were created
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
               WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN ('customers', 'users', 'projects', 'buildings', 'panel_status_histories', 'panels', 'facades')
        ORDER BY tc.table_name, tc.constraint_name;
