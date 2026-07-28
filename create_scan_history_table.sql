-- Create scan_history table to track QR code scans
CREATE TABLE IF NOT EXISTS scan_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    panel_id UUID NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location TEXT, -- Human-readable location derived from lat/lng
    created_at_device TIMESTAMP WITH TIME ZONE, -- Timestamp from device
    created_at_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- UTC timestamp
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_panel_id ON scan_history(panel_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can insert their own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can update their own scan history" ON scan_history;
DROP POLICY IF EXISTS "Users can delete their own scan history" ON scan_history;

-- Create RLS policies
-- Users can only see their own scan history
CREATE POLICY "Users can view their own scan history" ON scan_history
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own scan history
CREATE POLICY "Users can insert their own scan history" ON scan_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own scan history (for location updates)
CREATE POLICY "Users can update their own scan history" ON scan_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own scan history
CREATE POLICY "Users can delete their own scan history" ON scan_history
    FOR DELETE USING (auth.uid() = user_id);

-- Drop all versions of existing functions to avoid conflicts
DROP FUNCTION IF EXISTS insert_scan_history(UUID, UUID, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS insert_scan_history(UUID, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS insert_scan_history_simple(UUID, UUID, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS get_location_from_coordinates(DECIMAL, DECIMAL);

-- Function to get location from coordinates
CREATE OR REPLACE FUNCTION get_location_from_coordinates(
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8)
) RETURNS TEXT AS $$
BEGIN
    -- This is a placeholder function
    -- In a real implementation, you might want to use a geocoding service
    -- For now, we'll return a simple format
    IF lat IS NOT NULL AND lng IS NOT NULL THEN
        RETURN CONCAT('Lat: ', lat::TEXT, ', Lng: ', lng::TEXT);
    ELSE
        RETURN 'Location not available';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to insert scan history with automatic location generation
CREATE OR REPLACE FUNCTION insert_scan_history(
    p_panel_id UUID,
    p_user_id UUID,
    p_latitude DECIMAL(10, 8) DEFAULT NULL,
    p_longitude DECIMAL(11, 8) DEFAULT NULL,
    p_created_at_device TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_scan_id UUID;
    v_location TEXT;
    v_current_user_id UUID;
BEGIN
    -- Get current user ID, use provided user_id if auth.uid() is null
    v_current_user_id := COALESCE(auth.uid(), p_user_id);
    
    -- Check if we have a valid user ID
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required for scan history tracking';
    END IF;
    
    -- Generate location from coordinates
    v_location := get_location_from_coordinates(p_latitude, p_longitude);
    
    -- Insert the scan record
    INSERT INTO scan_history (
        panel_id,
        user_id,
        latitude,
        longitude,
        location,
        created_at_device
    ) VALUES (
        p_panel_id,
        v_current_user_id,
        p_latitude,
        p_longitude,
        v_location,
        p_created_at_device
    ) RETURNING id INTO v_scan_id;
    
    RETURN v_scan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative simpler function for direct insertion
CREATE OR REPLACE FUNCTION insert_scan_history_simple(
    p_panel_id UUID,
    p_user_id UUID,
    p_latitude DECIMAL(10, 8) DEFAULT NULL,
    p_longitude DECIMAL(11, 8) DEFAULT NULL,
    p_created_at_device TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_scan_id UUID;
    v_location TEXT;
BEGIN
    -- Generate location from coordinates
    v_location := get_location_from_coordinates(p_latitude, p_longitude);
    
    -- Insert the scan record
    INSERT INTO scan_history (
        panel_id,
        user_id,
        latitude,
        longitude,
        location,
        created_at_device
    ) VALUES (
        p_panel_id,
        p_user_id,
        p_latitude,
        p_longitude,
        v_location,
        p_created_at_device
    ) RETURNING id INTO v_scan_id;
    
    RETURN v_scan_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON scan_history TO authenticated;
GRANT EXECUTE ON FUNCTION insert_scan_history(UUID, UUID, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_scan_history_simple(UUID, UUID, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_location_from_coordinates(DECIMAL, DECIMAL) TO authenticated;

-- Create a view for easier querying with panel details
CREATE OR REPLACE VIEW scan_history_with_details AS
SELECT 
    sh.id,
    sh.panel_id,
    sh.user_id,
    sh.created_at,
    sh.latitude,
    sh.longitude,
    sh.location,
    sh.created_at_device,
    p.name as panel_name,
    p.status as panel_status,
    f.name as facade_name,
    b.name as building_name,
    pr.name as project_name
FROM scan_history sh
LEFT JOIN panels p ON sh.panel_id = p.id
LEFT JOIN facades f ON p.facade_id = f.id
LEFT JOIN buildings b ON f.building_id = b.id
LEFT JOIN projects pr ON b.project_id = pr.id;

-- Grant access to the view
GRANT SELECT ON scan_history_with_details TO authenticated;