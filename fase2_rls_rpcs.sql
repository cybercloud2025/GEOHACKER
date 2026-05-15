-- ============================================================
-- GEOHACKER — FASE 2: RLS ENDURECIDA + RPCs SECURITY DEFINER
-- ============================================================
-- Requiere: Fase 1 ya aplicada (security_hardening_phase1.sql)
-- Tiempo estimado: 5-10 min ejecución
-- Reversible: SI (guarda el SQL de rollback al final)
-- ============================================================
-- IMPORTANTE: Ejecuta este script COMPLETO de una sola vez.
-- Si una RPC falla parcialmente, hay riesgo de que la app rompa.
-- ============================================================

-- ============================================================
-- SECCIÓN A — RPCs DE LECTURA (SELECT)
-- ============================================================

-- A1. Obtener turno activo de un empleado
CREATE OR REPLACE FUNCTION get_active_shift(p_employee_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'employee_id', employee_id,
    'start_time', start_time,
    'status', status,
    'end_time', end_time
  ) INTO v_result
  FROM time_entries
  WHERE employee_id = p_employee_id
    AND end_time IS NULL
  ORDER BY start_time DESC
  LIMIT 1;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A2. Listar usuarios (empleados) para administrador
CREATE OR REPLACE FUNCTION get_users_for_admin(
  p_admin_id UUID,
  p_is_master BOOLEAN DEFAULT false
) RETURNS SETOF employees AS $$
BEGIN
  IF p_is_master THEN
    RETURN QUERY
      SELECT * FROM employees
      WHERE role != 'admin'
      ORDER BY created_at DESC;
  ELSE
    RETURN QUERY
      SELECT * FROM employees
      WHERE role != 'admin'
        AND admin_id = p_admin_id
      ORDER BY created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A3. Listar administradores
CREATE OR REPLACE FUNCTION get_admins_list()
RETURNS SETOF employees AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM employees
    WHERE role = 'admin' OR pin_text LIKE '@%'
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A4. IDs de empleados con turno activo (para dashboard)
CREATE OR REPLACE FUNCTION get_active_employee_ids()
RETURNS TABLE(employee_id UUID) AS $$
BEGIN
  RETURN QUERY
    SELECT t.employee_id FROM time_entries t
    WHERE t.status = 'active' AND t.end_time IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A5. Admins disponibles para asignación (excluye Master)
CREATE OR REPLACE FUNCTION get_admins_for_assignment()
RETURNS TABLE(
  id UUID,
  first_name TEXT,
  last_name TEXT,
  invite_code TEXT,
  company_name TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT e.id, e.first_name, e.last_name, e.invite_code, e.company_name
    FROM employees e
    WHERE e.role = 'admin'
      AND (e.invite_code IS NULL OR e.invite_code != 'CORP-18EC')
    ORDER BY e.first_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A6. Turnos activos con datos de empleado (LiveUserMap)
CREATE OR REPLACE FUNCTION get_active_shifts_with_employees()
RETURNS TABLE(
  shift_id UUID,
  employee_id UUID,
  start_time TIMESTAMPTZ,
  status TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      t.id,
      t.employee_id,
      t.start_time,
      t.status,
      e.first_name,
      e.last_name,
      e.role,
      e.avatar_url
    FROM time_entries t
    JOIN employees e ON e.id = t.employee_id
    WHERE t.end_time IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A7. Última localización conocida de un turno
CREATE OR REPLACE FUNCTION get_latest_location(p_time_entry_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'latitude', latitude,
    'longitude', longitude,
    'accuracy', accuracy,
    'heading', heading,
    'speed', speed,
    'battery_level', battery_level,
    'timestamp', timestamp
  ) INTO v_result
  FROM locations
  WHERE time_entry_id = p_time_entry_id
  ORDER BY timestamp DESC
  LIMIT 1;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- A8. Obtener un setting del sistema
CREATE OR REPLACE FUNCTION get_system_setting(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value
  FROM system_settings
  WHERE key = p_key
  LIMIT 1;
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- SECCIÓN B — RPCs DE ESCRITURA (UPDATE/INSERT/DELETE)
-- ============================================================

-- B1. Actualizar un setting del sistema (solo invocable por admin)
CREATE OR REPLACE FUNCTION set_system_setting(
  p_key TEXT,
  p_value JSONB,
  p_actor_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Validar que el actor es admin (si se proporciona)
  IF p_actor_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM employees
      WHERE id = p_actor_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Solo administradores pueden modificar settings';
    END IF;
  END IF;

  UPDATE system_settings
  SET value = p_value, updated_at = NOW()
  WHERE key = p_key;

  PERFORM log_audit_event(
    'setting_updated', p_actor_id, NULL,
    jsonb_build_object('key', p_key, 'value', p_value)
  );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B2. Cambiar rol de un usuario (admin/employee)
CREATE OR REPLACE FUNCTION update_user_role(
  p_user_id UUID,
  p_new_role TEXT,
  p_actor_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_old_role TEXT;
BEGIN
  IF p_new_role NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_new_role;
  END IF;

  IF p_actor_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM employees
      WHERE id = p_actor_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Solo administradores pueden cambiar roles';
    END IF;
  END IF;

  SELECT role INTO v_old_role FROM employees WHERE id = p_user_id;

  UPDATE employees SET role = p_new_role WHERE id = p_user_id;

  PERFORM log_audit_event(
    'role_changed', p_actor_id, p_user_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role)
  );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B3. Actualizar empleado (genérico, controlado)
CREATE OR REPLACE FUNCTION update_employee_safe(
  p_user_id UUID,
  p_data JSONB,
  p_actor_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_email TEXT;
  v_pin_text TEXT;
  v_role TEXT;
  v_verified BOOLEAN;
  v_admin_id UUID;
  v_invite_code TEXT;
  v_company_name TEXT;
  v_fiscal_id TEXT;
BEGIN
  -- Validar admin
  IF p_actor_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM employees
      WHERE id = p_actor_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Solo administradores pueden modificar empleados';
    END IF;
  END IF;

  -- Extraer campos permitidos (whitelist explícita)
  v_first_name   := p_data->>'first_name';
  v_last_name    := p_data->>'last_name';
  v_email        := p_data->>'employee_email';
  v_pin_text     := p_data->>'pin_text';
  v_role         := p_data->>'role';
  v_verified     := (p_data->>'verified')::BOOLEAN;
  v_admin_id     := (p_data->>'admin_id')::UUID;
  v_invite_code  := p_data->>'invite_code';
  v_company_name := p_data->>'company_name';
  v_fiscal_id    := p_data->>'fiscal_id';

  UPDATE employees SET
    first_name     = COALESCE(v_first_name, first_name),
    last_name      = COALESCE(v_last_name, last_name),
    employee_email = COALESCE(v_email, employee_email),
    pin_text       = COALESCE(v_pin_text, pin_text),
    pin_hash       = CASE WHEN v_pin_text IS NOT NULL
                          THEN crypt(v_pin_text, gen_salt('bf'))
                          ELSE pin_hash END,
    role           = COALESCE(v_role, role),
    verified       = COALESCE(v_verified, verified),
    admin_id       = COALESCE(v_admin_id, admin_id),
    invite_code    = COALESCE(v_invite_code, invite_code),
    company_name   = COALESCE(v_company_name, company_name),
    fiscal_id      = COALESCE(v_fiscal_id, fiscal_id)
  WHERE id = p_user_id;

  PERFORM log_audit_event(
    'employee_updated', p_actor_id, p_user_id,
    jsonb_build_object('fields', p_data)
  );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B4. Borrar empleado de forma segura (cascade-aware)
CREATE OR REPLACE FUNCTION delete_employee_safe(
  p_user_id UUID,
  p_actor_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_master_id UUID;
  v_target_role TEXT;
  v_target_invite TEXT;
BEGIN
  -- Validar admin actor
  IF p_actor_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM employees
      WHERE id = p_actor_id AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Solo administradores pueden borrar usuarios';
    END IF;
  END IF;

  -- Proteger Master Admin
  SELECT role, invite_code INTO v_target_role, v_target_invite
  FROM employees WHERE id = p_user_id;

  IF v_target_invite = 'CORP-18EC' THEN
    RAISE EXCEPTION 'No se puede borrar al Administrador Maestro';
  END IF;

  -- Reasignar dependientes al Master antes de borrar
  SELECT id INTO v_master_id FROM employees
  WHERE invite_code = 'CORP-18EC' LIMIT 1;

  UPDATE employees SET admin_id = v_master_id
  WHERE admin_id = p_user_id;

  -- Borrar
  DELETE FROM employees WHERE id = p_user_id;

  PERFORM log_audit_event(
    'employee_deleted', p_actor_id, p_user_id,
    jsonb_build_object('role', v_target_role, 'invite_code', v_target_invite)
  );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B5. Iniciar descanso
CREATE OR REPLACE FUNCTION start_break_safe(
  p_time_entry_id UUID,
  p_reason TEXT
) RETURNS UUID AS $$
DECLARE
  v_break_id UUID;
BEGIN
  INSERT INTO breaks(time_entry_id, start_time, reason)
  VALUES (p_time_entry_id, NOW(), p_reason)
  RETURNING id INTO v_break_id;

  UPDATE time_entries SET status = 'break'
  WHERE id = p_time_entry_id;

  RETURN v_break_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B6. Finalizar descanso
CREATE OR REPLACE FUNCTION end_break_safe(
  p_time_entry_id UUID,
  p_break_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_break_id IS NOT NULL THEN
    UPDATE breaks SET end_time = NOW()
    WHERE id = p_break_id AND end_time IS NULL;
  ELSE
    UPDATE breaks SET end_time = NOW()
    WHERE time_entry_id = p_time_entry_id AND end_time IS NULL;
  END IF;

  UPDATE time_entries SET status = 'active'
  WHERE id = p_time_entry_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B7. Insertar localización (con validación de turno activo)
CREATE OR REPLACE FUNCTION insert_location_safe(
  p_employee_id  UUID,
  p_time_entry_id UUID,
  p_latitude     DOUBLE PRECISION,
  p_longitude    DOUBLE PRECISION,
  p_accuracy     DOUBLE PRECISION DEFAULT NULL,
  p_heading      DOUBLE PRECISION DEFAULT NULL,
  p_speed        DOUBLE PRECISION DEFAULT NULL,
  p_battery_level INT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Validar que el turno existe y está activo
  IF NOT EXISTS(
    SELECT 1 FROM time_entries
    WHERE id = p_time_entry_id
      AND employee_id = p_employee_id
      AND end_time IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  -- Validar rango GPS razonable
  IF p_latitude < -90 OR p_latitude > 90 OR
     p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Coordenadas GPS fuera de rango';
  END IF;

  INSERT INTO locations(
    employee_id, time_entry_id, latitude, longitude,
    accuracy, heading, speed, battery_level, timestamp
  ) VALUES (
    p_employee_id, p_time_entry_id, p_latitude, p_longitude,
    p_accuracy, p_heading, p_speed, p_battery_level, NOW()
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SECCIÓN C — RPC LOGIN ENDURECIDO V2 (devuelve también settings)
-- ============================================================
-- (login_with_pin ya fue actualizado en Fase 1, no se toca aquí)


-- ============================================================
-- SECCIÓN D — GRANT EXECUTE A FUNCIONES
-- ============================================================
-- anon y authenticated pueden EJECUTAR funciones, pero ya NO leerán/escribirán
-- tablas directamente cuando bloqueemos RLS abajo.
GRANT EXECUTE ON FUNCTION get_active_shift(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_users_for_admin(UUID, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admins_list() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_employee_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admins_for_assignment() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_shifts_with_employees() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_latest_location(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_system_setting(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_system_setting(TEXT, JSONB, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_role(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_employee_safe(UUID, JSONB, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_employee_safe(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION start_break_safe(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION end_break_safe(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_location_safe(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT) TO anon, authenticated;


-- ============================================================
-- SECCIÓN E — BLOQUEO RLS (deny direct access)
-- ============================================================
-- ⚠️ ESTA SECCIÓN BLOQUEA EL ACCESO DIRECTO A TABLAS.
-- A partir de aquí, frontend DEBE pasar por RPCs.
-- Asegúrate de haber desplegado el frontend nuevo ANTES de correr esta sección,
-- o COMÉNTALA y corre las secciones A-D primero, luego despliega frontend, luego E.
-- ============================================================

-- Quitar las políticas abiertas existentes
DROP POLICY IF EXISTS "Permiso Total Publico" ON employees;
DROP POLICY IF EXISTS "Permiso Total Publico" ON time_entries;
DROP POLICY IF EXISTS "Permiso Total Publico" ON locations;
DROP POLICY IF EXISTS "Permiso Total Publico" ON breaks;
DROP POLICY IF EXISTS "Permiso Total Publico" ON system_settings;
DROP POLICY IF EXISTS "Allow all" ON employees;
DROP POLICY IF EXISTS "Allow all" ON time_entries;
DROP POLICY IF EXISTS "Allow all" ON locations;
DROP POLICY IF EXISTS "Allow all" ON breaks;
DROP POLICY IF EXISTS "Public full access" ON employees;
DROP POLICY IF EXISTS "Public full access" ON time_entries;
DROP POLICY IF EXISTS "Public full access" ON locations;

-- Asegurar RLS habilitado
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas DENY ALL para anon/authenticated (todo pasa por RPCs SECURITY DEFINER)
CREATE POLICY "deny_anon_employees"    ON employees      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_anon_time_entries" ON time_entries   AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_anon_locations"    ON locations      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_anon_breaks"       ON breaks         AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_anon_settings"     ON system_settings AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);


-- ============================================================
-- SECCIÓN F — VERIFICACIÓN POST-DESPLIEGUE
-- ============================================================
SELECT 'RPCs creadas' as check_type, COUNT(*) as count
FROM pg_proc
WHERE proname IN (
  'get_active_shift','get_users_for_admin','get_admins_list',
  'get_active_employee_ids','get_admins_for_assignment',
  'get_active_shifts_with_employees','get_latest_location',
  'get_system_setting','set_system_setting','update_user_role',
  'update_employee_safe','delete_employee_safe',
  'start_break_safe','end_break_safe','insert_location_safe'
)
UNION ALL
SELECT 'Políticas RESTRICTIVE deny activas', COUNT(*)
FROM pg_policies
WHERE policyname LIKE 'deny_anon%';

-- Esperado:
--   RPCs creadas                        | 15
--   Políticas RESTRICTIVE deny activas  | 5


-- ============================================================
-- ROLLBACK (guardar por si algo rompe)
-- ============================================================
/*
-- Si la app rompe tras bloquear RLS, ejecuta esto para revertir:
DROP POLICY IF EXISTS "deny_anon_employees"    ON employees;
DROP POLICY IF EXISTS "deny_anon_time_entries" ON time_entries;
DROP POLICY IF EXISTS "deny_anon_locations"    ON locations;
DROP POLICY IF EXISTS "deny_anon_breaks"       ON breaks;
DROP POLICY IF EXISTS "deny_anon_settings"     ON system_settings;

CREATE POLICY "Permiso Total Publico" ON employees      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON time_entries   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON locations      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON breaks         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON system_settings FOR ALL USING (true) WITH CHECK (true);
*/
