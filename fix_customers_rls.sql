-- Fix RLS policies for customers table
-- Run this in your Supabase SQL editor

-- Check if RLS is enabled on customers table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'customers';

-- Check existing policies on customers table
SELECT 
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'customers';

-- Disable RLS on customers table if it's causing issues
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS but allow all operations, create a policy
-- First, enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations on customers" ON public.customers;

-- Create a policy that allows all operations for authenticated users
CREATE POLICY "Allow all operations on customers" ON public.customers
FOR ALL USING (true) WITH CHECK (true);

-- Alternative: Create more specific policies
-- For SELECT operations
CREATE POLICY "Allow select on customers" ON public.customers
FOR SELECT USING (true);

-- For INSERT operations
CREATE POLICY "Allow insert on customers" ON public.customers
FOR INSERT WITH CHECK (true);

-- For UPDATE operations
CREATE POLICY "Allow update on customers" ON public.customers
FOR UPDATE USING (true) WITH CHECK (true);

-- For DELETE operations
CREATE POLICY "Allow delete on customers" ON public.customers
FOR DELETE USING (true);

-- Check the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'customers';
