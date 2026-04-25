-- ============================================================
-- GEOHACKER — RLS Hardening
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ============================================================
-- PASO 1: Eliminar políticas permisivas actuales (puerta abierta)
-- ============================================================
DROP POLICY IF EXISTS "Allow all for anon" ON employees;
DROP POLICY IF EXISTS "Allow all for anon" ON time_entries;
DROP POLICY IF EXISTS "Allow all for anon" ON locations;
DROP POLICY IF EXISTS "Allow all for anon" ON breaks;
DROP POLICY IF EXISTS "Allow all for anon" ON system_settings;

-- ============================================================
-- PASO 2: system_settings — Solo lectura pública
-- Los writes van por RPC (toggle_system_setting)
-- ============================================================
CREATE POLICY "public_read_settings" ON system_settings
    FOR SELECT TO anon USING (true);

-- employees, time_entries, locations, breaks:
-- Sin políticas = todo bloqueado para anon.
-- El acceso real va a través de RPCs SECURITY DEFINER.

-- ============================================================
-- PASO 3: Helper — Validar que el caller es admin verificado
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin(p_employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees
        WHERE id = p_employee_id
          AND role = 'admin'
          AND verified = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 4: RPC — Obtener empleados (reemplaza supabase.from('employees'))
-- ============================================================
DROP FUNCTION IF EXISTS get_employees(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION get_employees(
    p_caller_id UUID,
    p_is_master  BOOLEAN DEFAULT FALSE
)
RETURNS SETOF employees AS $$
BEGIN
    IF NOT is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador';
    END IF;

    IF p_is_master THEN
        RETURN QUERY
            SELECT * FROM employees
            WHERE role != 'admin'
            ORDER BY created_at DESC;
    ELSE
        RETURN QUERY
            SELECT * FROM employees
            WHERE role != 'admin'
              AND admin_id = p_caller_id
            ORDER BY created_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 5: RPC — Obtener admins
-- ============================================================
DROP FUNCTION IF EXISTS get_admins(UUID);
CREATE OR REPLACE FUNCTION get_admins(p_caller_id UUID)
RETURNS SETOF employees AS $$
BEGIN
    IF NOT is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador';
    END IF;

    RETURN QUERY
        SELECT * FROM employees
        WHERE role = 'admin' OR pin_text ILIKE '@%'
        ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 6: RPC — IDs de empleados activos (para mapa en vivo)
-- ============================================================
DROP FUNCTION IF EXISTS get_active_employee_ids(UUID);
CREATE OR REPLACE FUNCTION get_active_employee_ids(p_caller_id UUID)
RETURNS TABLE(employee_id UUID) AS $$
BEGIN
    IF NOT is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador';
    END IF;

    RETURN QUERY
        SELECT te.employee_id FROM time_entries te
        WHERE te.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 7: RPC — Cambiar rol de empleado
-- ============================================================
DROP FUNCTION IF EXISTS change_employee_role(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION change_employee_role(
    p_caller_id UUID,
    p_target_id UUID,
    p_new_role  TEXT
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador';
    END IF;

    IF p_new_role NOT IN ('employee', 'admin') THEN
        RAISE EXCEPTION 'Rol no válido';
    END IF;

    UPDATE employees SET role = p_new_role WHERE id = p_target_id;
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 8: RPC — Eliminar empleado
-- ============================================================
DROP FUNCTION IF EXISTS delete_employee(UUID, UUID);
CREATE OR REPLACE FUNCTION delete_employee(
    p_caller_id UUID,
    p_target_id UUID
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador';
    END IF;

    IF p_caller_id = p_target_id THEN
        RAISE EXCEPTION 'No puedes eliminar tu propia cuenta';
    END IF;

    DELETE FROM employees WHERE id = p_target_id;
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 9: RPC — Actualizar datos de empleado
-- ============================================================
DROP FUNCTION IF EXISTS update_employee_data(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION update_employee_data(
    p_caller_id UUID,
    p_target_id UUID,
    p_data      JSONB
)
RETURNS JSON AS $$
DECLARE
    is_self         BOOLEAN := (p_caller_id = p_target_id);
    is_caller_admin BOOLEAN := is_admin(p_caller_id);
BEGIN
    IF NOT is_caller_admin AND NOT is_self THEN
        RAISE EXCEPTION 'Acceso denegado';
    END IF;

    IF is_caller_admin THEN
        UPDATE employees SET
            first_name     = COALESCE(p_data->>'first_name',     first_name),
            last_name      = COALESCE(p_data->>'last_name',      last_name),
            employee_email = COALESCE(p_data->>'employee_email', employee_email),
            pin_text       = COALESCE(p_data->>'pin_text',       pin_text),
            role           = COALESCE(p_data->>'role',           role),
            verified       = COALESCE((p_data->>'verified')::boolean, verified),
            admin_id       = COALESCE((p_data->>'admin_id')::UUID, admin_id),
            invite_code    = COALESCE(p_data->>'invite_code',    invite_code),
            company_name   = COALESCE(p_data->>'company_name',   company_name),
            fiscal_id      = COALESCE(p_data->>'fiscal_id',      fiscal_id)
        WHERE id = p_target_id;
    ELSE
        -- Empleado solo puede cambiar su propio email y avatar
        UPDATE employees SET
            employee_email = COALESCE(p_data->>'employee_email', employee_email),
            avatar_url     = COALESCE(p_data->>'avatar_url',     avatar_url)
        WHERE id = p_target_id;
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 10: RPC — Modificar configuración del sistema
-- ============================================================
DROP FUNCTION IF EXISTS toggle_system_setting(UUID, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION toggle_system_setting(
    p_caller_id UUID,
    p_key       TEXT,
    p_value     BOOLEAN
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin(p_caller_id) THEN
        RAISE EXCEPTION 'Acceso denegado: se requiere rol de administrador';
    END IF;

    UPDATE system_settings
    SET value      = p_value::TEXT::JSONB,
        updated_at = now()
    WHERE key = p_key;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 11: RPC — Insertar punto GPS (reemplaza insert directo)
-- ============================================================
DROP FUNCTION IF EXISTS insert_location_point(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
CREATE OR REPLACE FUNCTION insert_location_point(
    p_employee_id  UUID,
    p_shift_id     UUID,
    p_latitude     DOUBLE PRECISION,
    p_longitude    DOUBLE PRECISION,
    p_accuracy     DOUBLE PRECISION DEFAULT NULL,
    p_heading      DOUBLE PRECISION DEFAULT NULL,
    p_speed        DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    -- Verificar que el turno pertenece a este empleado y está activo
    IF NOT EXISTS (
        SELECT 1 FROM time_entries
        WHERE id = p_shift_id
          AND employee_id = p_employee_id
          AND end_time IS NULL
    ) THEN
        RAISE EXCEPTION 'Turno no válido para este empleado';
    END IF;

    INSERT INTO locations (
        employee_id, time_entry_id,
        latitude, longitude, accuracy, heading, speed
    ) VALUES (
        p_employee_id, p_shift_id,
        p_latitude, p_longitude, p_accuracy, p_heading, p_speed
    );

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 12: RPC — Iniciar pausa (reemplaza inserts directos)
-- ============================================================
DROP FUNCTION IF EXISTS start_break(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION start_break(
    p_employee_id UUID,
    p_shift_id    UUID,
    p_reason      TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_break_id UUID;
BEGIN
    -- Verificar que el turno pertenece a este empleado
    IF NOT EXISTS (
        SELECT 1 FROM time_entries
        WHERE id = p_shift_id
          AND employee_id = p_employee_id
          AND end_time IS NULL
    ) THEN
        RAISE EXCEPTION 'Turno no válido para este empleado';
    END IF;

    INSERT INTO breaks (time_entry_id, start_time, reason)
    VALUES (p_shift_id, now(), p_reason)
    RETURNING id INTO v_break_id;

    UPDATE time_entries SET status = 'break' WHERE id = p_shift_id;

    RETURN json_build_object('success', true, 'break_id', v_break_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 13: RPC — Finalizar pausa (reemplaza updates directos)
-- ============================================================
DROP FUNCTION IF EXISTS end_break(UUID, UUID, UUID);
CREATE OR REPLACE FUNCTION end_break(
    p_employee_id UUID,
    p_shift_id    UUID,
    p_break_id    UUID DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    -- Verificar que el turno pertenece a este empleado
    IF NOT EXISTS (
        SELECT 1 FROM time_entries
        WHERE id = p_shift_id
          AND employee_id = p_employee_id
          AND end_time IS NULL
    ) THEN
        RAISE EXCEPTION 'Turno no válido para este empleado';
    END IF;

    IF p_break_id IS NOT NULL THEN
        UPDATE breaks SET end_time = now() WHERE id = p_break_id;
    ELSE
        -- Fallback: cerrar última pausa abierta del turno
        UPDATE breaks SET end_time = now()
        WHERE time_entry_id = p_shift_id AND end_time IS NULL;
    END IF;

    UPDATE time_entries SET status = 'active' WHERE id = p_shift_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PASO 14: RPC — Turno activo del empleado (para syncStatus)
-- ============================================================
DROP FUNCTION IF EXISTS get_active_shift(UUID);
CREATE OR REPLACE FUNCTION get_active_shift(p_employee_id UUID)
RETURNS TABLE(
    id         UUID,
    status     TEXT,
    start_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
        SELECT te.id, te.status, te.start_time
        FROM time_entries te
        WHERE te.employee_id = p_employee_id
          AND te.end_time IS NULL
        ORDER BY te.start_time DESC
        LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ✅ LISTO
-- Todas las operaciones sensibles pasan por RPCs SECURITY DEFINER.
-- El acceso directo a tablas desde el cliente queda bloqueado.
-- ============================================================
