-- Create storage bucket for panel images
-- Run this in your Supabase SQL editor

-- First, let's check if the bucket exists and create it if it doesn't
DO $$
BEGIN
    -- Check if the bucket exists
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'panel-images'
    ) THEN
        -- Create the storage bucket
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'panel-images', 
            'panel-images', 
            true,
            5242880, -- 5MB limit
            ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        );
    END IF;
END $$;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to upload panel images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to panel images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update panel images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete panel images" ON storage.objects;

-- Set up storage policies for the panel-images bucket
-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload panel images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'panel-images' AND 
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow public read access to panel images
CREATE POLICY "Allow public read access to panel images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'panel-images'
);

-- Allow authenticated users to update their own images
CREATE POLICY "Allow authenticated users to update panel images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'panel-images' AND 
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Allow authenticated users to delete panel images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'panel-images' AND 
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'panel-images'; 