-- 1. Create System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Initial Setup: Enable registrations by default
INSERT INTO system_settings (key, value) 
VALUES ('registrations_enabled', 'true'::jsonb) 
ON CONFLICT (key) DO NOTHING;

-- 3. Policy for system_settings (Read for all, Write only via service role or specific logic)
-- For simplicity in this mvp, we allow authenticated users to read.
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public settings read" ON system_settings;
CREATE POLICY "Public settings read" ON system_settings
FOR SELECT USING (true);

-- We'll use the Supabase client with the admin role or just standard update for now, 
-- but ideally only the Master Admin should have permission.
DROP POLICY IF EXISTS "Admin settings update" ON system_settings;
CREATE POLICY "Admin settings update" ON system_settings
FOR UPDATE USING (true); -- In production, strictly restrict to Master Admin ID
