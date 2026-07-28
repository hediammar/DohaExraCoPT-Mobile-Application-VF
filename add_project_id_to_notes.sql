-- Add project_id field to notes table
ALTER TABLE public.notes 
ADD COLUMN project_id UUID NULL;

-- Add foreign key constraint to projects table
ALTER TABLE public.notes 
ADD CONSTRAINT notes_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_notes_project_id ON public.notes(project_id);
