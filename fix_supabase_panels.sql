-- Option 1: Disable RLS on panels table (if it's causing the issue)
-- ALTER TABLE public.panels DISABLE ROW LEVEL SECURITY;

-- Option 2: Create a permissive policy that allows all operations for authenticated users
-- This is safer than disabling RLS completely
CREATE POLICY "Allow all operations for authenticated users" ON public.panels
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Option 3: If you want to keep RLS but ensure it doesn't limit results, 
-- create a policy that allows reading all panels
CREATE POLICY "Allow read all panels" ON public.panels
FOR SELECT TO authenticated
USING (true);

-- Option 4: Check and potentially modify the log_panel_status_change function
-- to ensure it's not causing any issues
-- You can view the function with:
-- \df+ log_panel_status_change

-- Option 5: If the issue is with the function, you might need to recreate it
-- Here's a basic version that should work:
CREATE OR REPLACE FUNCTION log_panel_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO panel_status_histories (panel_id, status, user_id, created_at)
        VALUES (
            COALESCE(NEW.id, OLD.id),
            COALESCE(NEW.status, OLD.status),
            COALESCE(NEW.user_id, OLD.user_id),
            NOW()
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Option 6: Check if there are any database-level settings limiting query results
-- This would need to be checked in Supabase dashboard under Settings > Database
-- Look for "Max Rows" or similar settings

-- Option 7: Create an index to improve query performance
CREATE INDEX IF NOT EXISTS idx_panels_status ON public.panels (status);
CREATE INDEX IF NOT EXISTS idx_panels_type ON public.panels (type);
CREATE INDEX IF NOT EXISTS idx_panels_building_id ON public.panels (building_id);
CREATE INDEX IF NOT EXISTS idx_panels_facade_id ON public.panels (facade_id);
