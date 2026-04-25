-- FIX: Update clock_in to insert the initial location into the locations table
-- This ensures the user appears on the map immediately even before the first GPS ping.

CREATE OR REPLACE FUNCTION clock_in(p_employee_id UUID, p_location JSONB)
RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  -- Check if already active
  IF EXISTS (SELECT 1 FROM time_entries WHERE employee_id = p_employee_id AND status IN ('active', 'break')) THEN
    RAISE EXCEPTION 'Employee already has an active shift';
  END IF;

  INSERT INTO time_entries (employee_id, start_time, status, start_location)
  VALUES (p_employee_id, NOW(), 'active', p_location)
  RETURNING id INTO v_entry_id;

  -- Insert into locations table if valid location provided
  -- This bridges the gap between clock-in and the first background GPS ping
  IF p_location IS NOT NULL AND p_location ? 'latitude' AND p_location ? 'longitude' THEN
     INSERT INTO locations (
        employee_id, 
        time_entry_id, 
        latitude, 
        longitude, 
        accuracy, 
        heading, 
        speed, 
        timestamp
     )
     VALUES (
        p_employee_id, 
        v_entry_id, 
        (p_location->>'latitude')::DOUBLE PRECISION, 
        (p_location->>'longitude')::DOUBLE PRECISION,
        COALESCE((p_location->>'accuracy')::DOUBLE PRECISION, 0), 
        COALESCE((p_location->>'heading')::DOUBLE PRECISION, 0), 
        COALESCE((p_location->>'speed')::DOUBLE PRECISION, 0), 
        NOW()
     );
  END IF;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
