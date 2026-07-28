-- Fix RLS policies for buildings table
-- Run this in your Supabase SQL editor

-- Check if RLS is enabled on buildings table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'buildings';

-- Disable RLS on buildings table if it's causing issues
ALTER TABLE public.buildings DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS but allow all operations, create a policy
-- First, enable RLS
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations on buildings" ON public.buildings;

-- Create a policy that allows all operations for authenticated users
CREATE POLICY "Allow all operations on buildings" ON public.buildings
FOR ALL USING (true) WITH CHECK (true);

-- Alternative: Create more specific policies
-- For SELECT operations
CREATE POLICY "Allow select on buildings" ON public.buildings
FOR SELECT USING (true);

-- For INSERT operations
CREATE POLICY "Allow insert on buildings" ON public.buildings
FOR INSERT WITH CHECK (true);

-- For UPDATE operations
CREATE POLICY "Allow update on buildings" ON public.buildings
FOR UPDATE USING (true) WITH CHECK (true);

-- For DELETE operations
CREATE POLICY "Allow delete on buildings" ON public.buildings
FOR DELETE USING (true);

-- Check the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'buildings'; 