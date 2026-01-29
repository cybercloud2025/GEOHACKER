-- ==========================================
-- SCRIPT DE EMERGENCIA: INSERTAR DATOS DE PRUEBA (V2)
-- ==========================================

-- 1. Asegurar que los permisos están abiertos para lectura
DROP POLICY IF EXISTS "Allow all for select" ON time_entries;
CREATE POLICY "Allow all for select" ON time_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all for select" ON locations;
CREATE POLICY "Allow all for select" ON locations FOR SELECT USING (true);

-- 2. Obtener un ID de empleado real (el primero que encuentre)
-- Usaremos una variable temporal para el siguiente paso
DO $$
DECLARE
  v_emp_id UUID;
  v_shift_id UUID;
BEGIN
  -- Buscamos el primer empleado de la lista
  SELECT id INTO v_emp_id FROM employees LIMIT 1;
  
  IF v_emp_id IS NULL THEN
    RAISE NOTICE 'ERROR: No hay empleados en la tabla employees';
    RETURN;
  END IF;

  -- Insertamos un turno ficticio para ese empleado
  INSERT INTO time_entries (employee_id, start_time, status)
  VALUES (v_emp_id, NOW() - INTERVAL '30 minutes', 'active')
  RETURNING id INTO v_shift_id;

  -- Insertamos una ubicación ficticia (Madrid)
  INSERT INTO locations (employee_id, time_entry_id, latitude, longitude, accuracy)
  VALUES (v_emp_id, v_shift_id, 40.4168, -3.7038, 10);

  RAISE NOTICE 'EXITO: Se ha creado un turno de prueba para el empleado con ID %', v_emp_id;
END $$;

-- 3. VERIFICACION FINAL (Ejecuta esto para ver si hay datos)
SELECT * FROM time_entries WHERE end_time IS NULL;
