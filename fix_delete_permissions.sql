-- ==============================================================================
-- FIX DELETE PERMISSIONS
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Allow deletion of employees
-- Since we are using a custom PIN-based auth, we'll allow delete access.
-- In a production environment with Supabase Auth, you would restrict this to authenticated admins.
DROP POLICY IF EXISTS "Allow delete access for all" ON employees;
CREATE POLICY "Allow delete access for all" ON employees FOR DELETE USING (true);

-- 2. Ensure all related data is also deletable if RLS is strict
-- (Normally ON DELETE CASCADE handles this at the DB level, but some RLS setups require policies)
DROP POLICY IF EXISTS "Allow delete access for all" ON time_entries;
CREATE POLICY "Allow delete access for all" ON time_entries FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow delete access for all" ON locations;
CREATE POLICY "Allow delete access for all" ON locations FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow delete access for all" ON breaks;
CREATE POLICY "Allow delete access for all" ON breaks FOR DELETE USING (true);
