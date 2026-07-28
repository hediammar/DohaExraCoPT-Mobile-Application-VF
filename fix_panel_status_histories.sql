-- Fix for panel_status_histories table issue
-- This script renames the backup table to the correct name and sets up proper constraints

-- Step 1: Rename the backup table to the correct name
ALTER TABLE public.panel_status_histories_backup RENAME TO panel_status_histories;

-- Step 2: Update the primary key constraint name
ALTER TABLE public.panel_status_histories 
DROP CONSTRAINT IF EXISTS panel_status_histories_backup_pkey;

ALTER TABLE public.panel_status_histories 
ADD CONSTRAINT panel_status_histories_pkey PRIMARY KEY (id);

-- Step 3: Update foreign key constraint names
ALTER TABLE public.panel_status_histories 
DROP CONSTRAINT IF EXISTS panel_status_histories_backup_panel_id_fkey;

ALTER TABLE public.panel_status_histories 
ADD CONSTRAINT panel_status_histories_panel_id_fkey 
FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE;

ALTER TABLE public.panel_status_histories 
DROP CONSTRAINT IF EXISTS panel_status_histories_backup_user_id_fkey;

ALTER TABLE public.panel_status_histories 
ADD CONSTRAINT panel_status_histories_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_panel_status_histories_panel_id 
ON public.panel_status_histories USING btree (panel_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_panel_status_histories_user_id 
ON public.panel_status_histories USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_panel_status_histories_created_at 
ON public.panel_status_histories USING btree (created_at) TABLESPACE pg_default;

-- Step 5: Verify the table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'panel_status_histories' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 6: Test the table access
SELECT COUNT(*) FROM panel_status_histories;

-- Step 7: Verify foreign key constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'panel_status_histories'; 