-- Fix panel_groups status column removal
-- This script properly handles the trigger dependency before dropping the status column

-- First, drop the trigger that depends on the status column
DROP TRIGGER IF EXISTS panel_group_status_update ON public.panel_groups;

-- Then drop the status column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'panel_groups' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.panel_groups DROP COLUMN status;
        RAISE NOTICE 'Status column dropped from panel_groups table';
    ELSE
        RAISE NOTICE 'Status column does not exist in panel_groups table';
    END IF;
END $$;

-- Verify the column was dropped
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'panel_groups' 
ORDER BY ordinal_position;
