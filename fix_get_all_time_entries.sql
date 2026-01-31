-- ========================================================
-- FIX GET ALL TIME ENTRIES
-- Retrieves full history for the Admin Panel
-- ========================================================

DROP FUNCTION IF EXISTS get_all_time_entries();

CREATE OR REPLACE FUNCTION get_all_time_entries()
RETURNS TABLE (
  id UUID,
  employee_name TEXT,
  employee_role TEXT,
  employee_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  start_location JSONB,
  end_location JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    (e.first_name || ' ' || e.last_name) as employee_name,
    e.role as employee_role,
    t.employee_id,
    t.start_time,
    t.end_time,
    t.status,
    t.start_location,
    t.end_location
  FROM time_entries t
  JOIN employees e ON t.employee_id = e.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
