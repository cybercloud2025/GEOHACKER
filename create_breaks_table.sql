-- Create breaks table (Drop first to be clean)
DROP TABLE IF EXISTS breaks CASCADE;
CREATE TABLE breaks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE, start_time TIMESTAMPTZ DEFAULT NOW(), end_time TIMESTAMPTZ, reason TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

-- Policies (One liners)
CREATE POLICY "Insert own breaks" ON breaks FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM time_entries te WHERE te.id = time_entry_id AND te.employee_id = auth.uid()));

CREATE POLICY "Update own breaks" ON breaks FOR UPDATE USING (EXISTS (SELECT 1 FROM time_entries te WHERE te.id = time_entry_id AND te.employee_id = auth.uid()));

CREATE POLICY "View all breaks" ON breaks FOR SELECT USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = auth.uid() AND e.role = 'admin'));

CREATE POLICY "View own breaks" ON breaks FOR SELECT USING (EXISTS (SELECT 1 FROM time_entries te WHERE te.id = time_entry_id AND te.employee_id = auth.uid()));
