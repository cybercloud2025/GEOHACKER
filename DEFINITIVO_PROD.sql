-- ============================================================
-- GEO HACKER — SCHEMA DEFINITIVO DE PRODUCCIÓN (UNIFICADO)
-- Este script consolida: Esquema Base + Login V10 + Registro V5 + Seguridad RLS
-- ============================================================

-- 0. Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLA: employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    pin_text TEXT UNIQUE, -- Mantenemos por referencia administrativa (opcional, pero ayuda a la recuperación)
    pin_hash TEXT NOT NULL, -- Almacenamiento seguro
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
    verified BOOLEAN DEFAULT FALSE,
    employee_email TEXT,
    avatar_url TEXT,
    invite_code TEXT UNIQUE,
    admin_id UUID REFERENCES employees(id),
    company_name TEXT,
    fiscal_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA: time_entries
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'break')),
    start_location JSONB,
    end_location JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA: locations
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    battery_level INTEGER,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA: breaks
CREATE TABLE IF NOT EXISTS breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABLA: system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT 'true'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Configuración inicial
INSERT INTO system_settings (key, value) 
VALUES ('registrations_enabled', 'true'::jsonb) 
ON CONFLICT (key) DO NOTHING;

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_invite ON employees(invite_code);

-- 7. TRIGGER: Hashing Automático de PIN
CREATE OR REPLACE FUNCTION trigger_hash_pin()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (NEW.pin_text IS DISTINCT FROM OLD.pin_text) THEN
        IF NEW.pin_text IS NOT NULL THEN
            NEW.pin_hash := crypt(NEW.pin_text, gen_salt('bf'));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hash_pin ON employees;
CREATE TRIGGER trg_hash_pin
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION trigger_hash_pin();

-- 8. RPC: login_with_pin (V10)
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', id,
        'first_name', first_name,
        'last_name', last_name,
        'role', role,
        'invite_code', invite_code,
        'admin_id', admin_id,
        'verified', verified,
        'employee_email', employee_email,
        'avatar_url', avatar_url
    ) INTO v_result
    FROM employees
    WHERE is_active = true 
      AND (pin_hash = crypt(p_pin, pin_hash) OR pin_text = p_pin)
    LIMIT 1;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: register_employee_with_code (V5 Simplificado)
CREATE OR REPLACE FUNCTION register_employee_with_code(
    p_first_name TEXT,
    p_last_name TEXT,
    p_pin TEXT,
    p_email TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_invite_code TEXT DEFAULT NULL,
    p_verified BOOLEAN DEFAULT false,
    p_company_name TEXT DEFAULT NULL,
    p_fiscal_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_id UUID;
    v_role TEXT := 'employee';
    v_target_admin_id UUID := NULL;
    v_target_admin_email TEXT := NULL;
    v_final_invite_code TEXT := p_invite_code;
BEGIN
    -- Determinar Rol
    IF p_invite_code = 'NEW' OR LEFT(p_pin, 1) = '@' THEN
        v_role := 'admin';
        IF p_invite_code = 'NEW' OR p_invite_code IS NULL THEN
            v_final_invite_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
        END IF;
    ELSE
        v_role := 'employee';
    END IF;

    -- Vincular con Administrador
    IF v_role = 'employee' THEN
        IF p_invite_code IS NOT NULL AND p_invite_code != '' THEN
            SELECT id, employee_email INTO v_target_admin_id, v_target_admin_email 
            FROM employees 
            WHERE invite_code = p_invite_code AND role = 'admin' LIMIT 1;
            
            IF v_target_admin_id IS NULL THEN
                RAISE EXCEPTION 'Código de organización inválido.';
            END IF;
        ELSE
            SELECT id, employee_email INTO v_target_admin_id, v_target_admin_email 
            FROM employees WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
        END IF;
    END IF;

    -- Notificación para nuevos Admins (El Maestro recibe el correo)
    IF v_role = 'admin' AND NOT p_verified THEN
        SELECT employee_email INTO v_target_admin_email FROM employees WHERE invite_code = 'CORP-18EC' LIMIT 1;
    END IF;

    -- Verificar PIN Duplicado
    IF EXISTS (SELECT 1 FROM employees WHERE pin_text = p_pin AND is_active = true) THEN
        RAISE EXCEPTION 'Este PIN ya está en uso por otro usuario.';
    END IF;

    -- Insertar (El trigger se encarga del pin_hash)
    INSERT INTO employees (
        first_name, last_name, pin_text, role, employee_email, 
        avatar_url, invite_code, admin_id, verified, company_name, fiscal_id
    )
    VALUES (
        p_first_name, p_last_name, p_pin, v_role, p_email, 
        p_avatar_url, v_final_invite_code, v_target_admin_id, p_verified,
        p_company_name, p_fiscal_id
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'id', v_id,
        'first_name', p_first_name,
        'last_name', p_last_name,
        'role', v_role,
        'invite_code', v_final_invite_code,
        'verified', p_verified,
        'admin_id', v_target_admin_id,
        'admin_email', v_target_admin_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: clock_in / clock_out / get_all_time_entries
CREATE OR REPLACE FUNCTION clock_in(p_employee_id UUID, p_location JSONB DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM time_entries WHERE employee_id = p_employee_id AND end_time IS NULL) THEN
        RAISE EXCEPTION 'Ya tienes un turno activo.';
    END IF;
    INSERT INTO time_entries (employee_id, start_time, status, start_location)
    VALUES (p_employee_id, now(), 'active', p_location) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clock_out(p_employee_id UUID, p_location JSONB DEFAULT NULL, p_notes TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE v_shift_id UUID;
BEGIN
    SELECT id INTO v_shift_id FROM time_entries WHERE employee_id = p_employee_id AND end_time IS NULL LIMIT 1;
    IF v_shift_id IS NULL THEN RAISE EXCEPTION 'No hay turno activo.'; END IF;
    UPDATE breaks SET end_time = now() WHERE time_entry_id = v_shift_id AND end_time IS NULL;
    UPDATE time_entries SET end_time = now(), status = 'completed', end_location = p_location, notes = p_notes WHERE id = v_shift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_all_time_entries()
RETURNS TABLE (
    id UUID, employee_name TEXT, employee_role TEXT, start_time TIMESTAMPTZ, 
    end_time TIMESTAMPTZ, status TEXT, start_location JSONB, end_location JSONB, 
    breaks_count BIGINT, total_break_duration JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.id,
        (e.first_name || ' ' || e.last_name)::TEXT,
        e.role::TEXT,
        te.start_time, te.end_time, te.status, te.start_location, te.end_location,
        COUNT(b.id),
        jsonb_build_object('hours', EXTRACT(EPOCH FROM COALESCE(SUM(b.end_time - b.start_time), INTERVAL '0'))/3600)
    FROM time_entries te
    JOIN employees e ON te.employee_id = e.id
    LEFT JOIN breaks b ON b.time_entry_id = te.id
    GROUP BY te.id, e.first_name, e.last_name, e.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Seguridad RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas simplificadas para producción (ajustar según necesidad)
CREATE POLICY "Public Read" ON employees FOR SELECT USING (true);
CREATE POLICY "Public Update" ON employees FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public Insert" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete" ON employees FOR DELETE USING (true);

-- Aplicar lo mismo a las demás tablas para evitar bloqueos durante el desarrollo
CREATE POLICY "Public Read TE" ON time_entries FOR SELECT USING (true);
CREATE POLICY "Public All TE" ON time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All LOC" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All BR" ON breaks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public All SET" ON system_settings FOR ALL USING (true) WITH CHECK (true);

-- 11. USUARIO MAESTRO (JOSE PC)
-- PIN: 01121973
INSERT INTO employees (first_name, last_name, pin_text, pin_hash, role, verified, invite_code)
VALUES ('JOSE', 'PC', '01121973', crypt('01121973', gen_salt('bf')), 'admin', true, 'CORP-18EC')
ON CONFLICT (pin_text) DO UPDATE 
SET pin_hash = crypt('01121973', gen_salt('bf')), role = 'admin', verified = true, invite_code = 'CORP-18EC';
