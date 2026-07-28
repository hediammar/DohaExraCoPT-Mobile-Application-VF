-- First, check if RLS is enabled
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'panels';

-- If RLS is enabled, create permissive policies
-- This allows all authenticated users to read all panels
CREATE POLICY "Enable read access for all authenticated users" ON public.panels
FOR SELECT TO authenticated
USING (true);

-- Allow authenticated users to insert panels
CREATE POLICY "Enable insert for authenticated users" ON public.panels
FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update panels
CREATE POLICY "Enable update for authenticated users" ON public.panels
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete panels
CREATE POLICY "Enable delete for authenticated users" ON public.panels
FOR DELETE TO authenticated
USING (true);

-- If you want to be more restrictive and only allow users to see panels from their projects:
-- CREATE POLICY "Users can only see panels from their projects" ON public.panels
-- FOR SELECT TO authenticated
-- USING (
--     project_id IN (
--         SELECT id FROM projects 
--         WHERE customer_id = (
--             SELECT customer_id FROM users WHERE id = auth.uid()
--         )
--     )
-- );
