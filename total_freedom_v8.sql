-- ========================================================
-- SOLUCION DEFINITIVA: PERMISOS TOTALES "ALLOW ALL" (V8)
-- Si DISABLE RLS no funciona, esto SI funcionará.
-- ========================================================

-- 1. Asegurar que RLS esté activo (para que las políticas se apliquen)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- 2. ELIMINAR CUALQUIER POLITICA ANTERIOR (Limpieza profunda)
DROP POLICY IF EXISTS "Allow all" ON employees;
DROP POLICY IF EXISTS "Allow all" ON time_entries;
DROP POLICY IF EXISTS "Allow all" ON locations;
DROP POLICY IF EXISTS "Public full access" ON employees;
DROP POLICY IF EXISTS "Public full access" ON time_entries;
DROP POLICY IF EXISTS "Public full access" ON locations;

-- 3. CREAR POLITICAS DE "LIBERTAD TOTAL" PARA TODOS LOS USUARIOS
-- Esto permite INSERT, SELECT, UPDATE y DELETE a cualquiera.
CREATE POLICY "Permiso Total Publico" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON locations FOR ALL USING (true) WITH CHECK (true);

-- 4. OTORGAR PERMISOS FISICOS A LOS ROLES DE SUPABASE
GRANT ALL ON TABLE employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE time_entries TO anon, authenticated, service_role;
GRANT ALL ON TABLE locations TO anon, authenticated, service_role;

-- 5. PRUEBA DE FUEGO (MADRID)
-- Ejecuta esto y mira si sale algún error en la consola de Supabase
DO $$
DECLARE
  v_emp_id UUID;
  v_shift_id UUID;
BEGIN
  SELECT id INTO v_emp_id FROM employees LIMIT 1;
  IF v_emp_id IS NOT NULL THEN
    INSERT INTO time_entries (employee_id, start_time, status)
    VALUES (v_emp_id, NOW(), 'active')
    RETURNING id INTO v_shift_id;

    INSERT INTO locations (employee_id, time_entry_id, latitude, longitude, accuracy)
    VALUES (v_emp_id, v_shift_id, 40.4168, -3.7038, 5);
  END IF;
END $$;

-- 6. VERIFICACION FINAL
SELECT 'TODO DESBLOQUEADO' as mensaje, count(*) as turnos_activos FROM time_entries WHERE end_time IS NULL;
