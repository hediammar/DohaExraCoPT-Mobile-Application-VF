-- Add dimension field to panels table
ALTER TABLE public.panels ADD COLUMN dimension character varying null;

-- Add comment to document the field
COMMENT ON COLUMN public.panels.dimension IS 'Panel dimensions (e.g., "2.5m x 1.2m" or "2500mm x 1200mm")';

-- Create index for better performance on dimension searches
CREATE INDEX IF NOT EXISTS idx_panels_dimension ON public.panels USING btree (dimension) TABLESPACE pg_default;
