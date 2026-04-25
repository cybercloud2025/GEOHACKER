-- ==========================================
-- FINAL MASTER FIX (V7)
-- ==========================================

-- 1. CLEANUP (Remove all previous failures to clear cache)
DROP FUNCTION IF EXISTS fetch_admin_map_data();
DROP FUNCTION IF EXISTS get_active_locations_v5();
DROP FUNCTION IF EXISTS get_live_locations();
DROP FUNCTION IF EXISTS test_rpc();

-- 2. TEST FUNCTION (Verify basic connectivity)
CREATE OR REPLACE FUNCTION test_rpc()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'CONEXION SQL OK';
END;
$$;

-- 3. MAIN DATA FUNCTION (V7)
CREATE OR REPLACE FUNCTION get_admin_live_data_v7()
RETURNS TABLE (
  employee_id UUID,
  first_name TEXT,
  last_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  battery_level INTEGER,
  last_ping TIMESTAMPTZ,
  shift_start_time TIMESTAMPTZ,
  status TEXT,
  has_gps BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.employee_id,
    e.first_name,
    e.last_name,
    l.latitude,
    l.longitude,
    l.accuracy,
    l.heading,
    l.speed,
    l.battery_level,
    l.timestamp as last_ping,
    t.start_time as shift_start_time,
    t.status,
    (l.latitude IS NOT NULL) as has_gps
  FROM time_entries t
  JOIN employees e ON t.employee_id = e.id
  LEFT JOIN LATERAL (
    SELECT 
      loc.latitude, loc.longitude, loc.accuracy, loc.heading, loc.speed, loc.battery_level, loc.timestamp
    FROM locations loc
    WHERE loc.time_entry_id = t.id
    ORDER BY loc.timestamp DESC
    LIMIT 1
  ) l ON true
  WHERE t.end_time IS NULL;
END;
$$;

-- 4. EXPLICIT PERMISSIONS
GRANT EXECUTE ON FUNCTION test_rpc() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_live_data_v7() TO anon, authenticated, service_role;

-- 5. NOTIFY POSTGREST CACHE (This is a trick to nudge the cache)
NOTIFY pgrst, 'reload schema';
