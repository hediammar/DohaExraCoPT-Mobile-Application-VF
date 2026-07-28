-- Create the notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT notes_pkey PRIMARY KEY (id)
);

-- Create the note_panel_groups junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.note_panel_groups (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    panel_group_id UUID NOT NULL REFERENCES public.panel_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT note_panel_groups_pkey PRIMARY KEY (id),
    CONSTRAINT note_panel_groups_unique UNIQUE (note_id, panel_group_id)
);

-- Enable RLS on notes table
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on note_panel_groups table
ALTER TABLE public.note_panel_groups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notes table
CREATE POLICY "Users can view notes" ON public.notes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert notes" ON public.notes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update notes" ON public.notes
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete notes" ON public.notes
    FOR DELETE USING (true);

-- Create RLS policies for note_panel_groups table
CREATE POLICY "Users can view note panel groups" ON public.note_panel_groups
    FOR SELECT USING (true);

CREATE POLICY "Users can insert note panel groups" ON public.note_panel_groups
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update note panel groups" ON public.note_panel_groups
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete note panel groups" ON public.note_panel_groups
    FOR DELETE USING (true);

-- Create function to add panel groups to a note
CREATE OR REPLACE FUNCTION add_panel_groups_to_note(
    note_id UUID,
    panel_group_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    panel_group_id UUID;
BEGIN
    -- Insert each panel group into the note
    FOREACH panel_group_id IN ARRAY panel_group_ids
    LOOP
        INSERT INTO note_panel_groups (note_id, panel_group_id)
        VALUES (note_id, panel_group_id)
        ON CONFLICT (note_id, panel_group_id) DO NOTHING;
    END LOOP;
END;
$$;

-- Create function to remove panel groups from a note
CREATE OR REPLACE FUNCTION remove_panel_groups_from_note(
    note_id UUID,
    panel_group_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM note_panel_groups 
    WHERE note_id = $1 
    AND panel_group_id = ANY($2);
END;
$$;

-- Create function to get panel groups for a note
CREATE OR REPLACE FUNCTION get_panel_groups_for_note(note_id UUID)
RETURNS TABLE (
    panel_group_id UUID,
    panel_group_name VARCHAR(100),
    panel_group_description TEXT,
    project_id UUID,
    project_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg.id as panel_group_id,
        pg.name as panel_group_name,
        pg.description as panel_group_description,
        pg.project_id,
        p.name as project_name
    FROM note_panel_groups npg
    JOIN panel_groups pg ON npg.panel_group_id = pg.id
    LEFT JOIN projects p ON pg.project_id = p.id
    WHERE npg.note_id = $1
    ORDER BY pg.name;
END;
$$;

-- Create function to get notes for a panel group
CREATE OR REPLACE FUNCTION get_notes_for_panel_group(panel_group_id UUID)
RETURNS TABLE (
    note_id UUID,
    note_title VARCHAR(255),
    note_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id as note_id,
        n.title as note_title,
        n.content as note_content,
        n.created_at
    FROM note_panel_groups npg
    JOIN notes n ON npg.note_id = n.id
    WHERE npg.panel_group_id = $1
    ORDER BY n.created_at DESC;
END;
$$;
