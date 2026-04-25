-- ============================================================
-- GEO HACKER — Schema Completo para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ==========================================
-- 1. TABLA: employees (usuarios y admins)
-- ==========================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    pin_text TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
    verified BOOLEAN DEFAULT FALSE,
    employee_email TEXT,
    avatar_url TEXT,
    invite_code TEXT,
    admin_id UUID REFERENCES employees(id),
    company_name TEXT,
    fiscal_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. TABLA: time_entries (fichajes)
-- ==========================================
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

-- ==========================================
-- 3. TABLA: locations (posiciones GPS)
-- ==========================================
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

-- ==========================================
-- 4. TABLA: breaks (pausas/descansos)
-- ==========================================
CREATE TABLE IF NOT EXISTS breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 5. TABLA: system_settings (configuración)
-- ==========================================
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT 'true'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar configuración inicial (solo si no existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'registrations_enabled') THEN
        INSERT INTO system_settings (key, value) VALUES ('registrations_enabled', 'true'::jsonb);
    END IF;
END $$;

-- ==========================================
-- 6. ÍNDICES para rendimiento
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_locations_time_entry ON locations(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_locations_employee ON locations(employee_id);
CREATE INDEX IF NOT EXISTS idx_breaks_time_entry ON breaks(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_pin ON employees(pin_text);

-- ==========================================
-- 7. FUNCIÓN RPC: login_with_pin
-- ==========================================
DROP FUNCTION IF EXISTS login_with_pin(TEXT);
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSON AS $$
DECLARE
    emp RECORD;
BEGIN
    SELECT * INTO emp FROM employees WHERE pin_text = p_pin;
    
    IF emp IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN row_to_json(emp);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. FUNCIÓN RPC: register_employee_with_code
-- ==========================================
DROP FUNCTION IF EXISTS register_employee_with_code(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT);
CREATE OR REPLACE FUNCTION register_employee_with_code(
    p_first_name TEXT,
    p_last_name TEXT,
    p_pin TEXT,
    p_email TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_invite_code TEXT DEFAULT NULL,
    p_verified BOOLEAN DEFAULT FALSE,
    p_company_name TEXT DEFAULT NULL,
    p_fiscal_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    new_emp RECORD;
    v_role TEXT := 'employee';
    v_invite_code TEXT;
    v_admin_id UUID;
    v_admin_email TEXT;
BEGIN
    -- Check if PIN already exists
    IF EXISTS (SELECT 1 FROM employees WHERE pin_text = p_pin) THEN
        RAISE EXCEPTION 'Ya existe un usuario con este PIN';
    END IF;

    -- Determine role and invite code
    IF p_pin LIKE '@%' THEN
        v_role := 'admin';
        IF p_invite_code = 'NEW' OR p_invite_code IS NULL THEN
            v_invite_code := 'CORP-' || upper(substr(md5(random()::text), 1, 4));
        ELSE
            v_invite_code := p_invite_code;
        END IF;
    ELSE
        v_role := 'employee';
        v_invite_code := p_invite_code;
        
        IF p_invite_code IS NOT NULL AND p_invite_code != '' THEN
            SELECT id, employee_email INTO v_admin_id, v_admin_email
            FROM employees 
            WHERE invite_code = p_invite_code AND role = 'admin'
            LIMIT 1;
        END IF;
    END IF;

    INSERT INTO employees (
        first_name, last_name, pin_text, role, verified,
        employee_email, avatar_url, invite_code, admin_id,
        company_name, fiscal_id
    ) VALUES (
        p_first_name, p_last_name, p_pin, v_role, p_verified,
        p_email, p_avatar_url, v_invite_code, v_admin_id,
        p_company_name, p_fiscal_id
    )
    RETURNING * INTO new_emp;

    RETURN json_build_object(
        'id', new_emp.id,
        'first_name', new_emp.first_name,
        'last_name', new_emp.last_name,
        'pin_text', new_emp.pin_text,
        'role', new_emp.role,
        'verified', new_emp.verified,
        'employee_email', new_emp.employee_email,
        'avatar_url', new_emp.avatar_url,
        'invite_code', new_emp.invite_code,
        'admin_id', new_emp.admin_id,
        'company_name', new_emp.company_name,
        'fiscal_id', new_emp.fiscal_id,
        'admin_email', v_admin_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 9. FUNCIÓN RPC: clock_in
-- ==========================================
DROP FUNCTION IF EXISTS clock_in(UUID, JSONB);
CREATE OR REPLACE FUNCTION clock_in(
    p_employee_id UUID,
    p_location JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_shift_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM time_entries 
        WHERE employee_id = p_employee_id 
        AND end_time IS NULL
    ) THEN
        RAISE EXCEPTION 'Employee already has an active shift';
    END IF;

    INSERT INTO time_entries (employee_id, start_time, status, start_location)
    VALUES (p_employee_id, now(), 'active', p_location)
    RETURNING id INTO v_shift_id;

    RETURN v_shift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 10. FUNCIÓN RPC: clock_out
-- ==========================================
DROP FUNCTION IF EXISTS clock_out(UUID, JSONB, TEXT);
CREATE OR REPLACE FUNCTION clock_out(
    p_employee_id UUID,
    p_location JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_shift_id UUID;
BEGIN
    SELECT id INTO v_shift_id 
    FROM time_entries 
    WHERE employee_id = p_employee_id 
    AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1;

    IF v_shift_id IS NULL THEN
        RAISE EXCEPTION 'No active shift found for this employee';
    END IF;

    UPDATE breaks 
    SET end_time = now() 
    WHERE time_entry_id = v_shift_id 
    AND end_time IS NULL;

    UPDATE time_entries 
    SET end_time = now(), 
        status = 'completed', 
        end_location = p_location,
        notes = p_notes
    WHERE id = v_shift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 11. FUNCIÓN RPC: get_all_time_entries
-- ==========================================
DROP FUNCTION IF EXISTS get_all_time_entries();
CREATE OR REPLACE FUNCTION get_all_time_entries()
RETURNS TABLE (
    id UUID,
    employee_name TEXT,
    employee_role TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT,
    start_location JSONB,
    end_location JSONB,
    breaks_count BIGINT,
    total_break_duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.id,
        (e.first_name || ' ' || e.last_name)::TEXT AS employee_name,
        e.role::TEXT AS employee_role,
        te.start_time,
        te.end_time,
        te.status,
        te.start_location,
        te.end_location,
        COUNT(b.id) AS breaks_count,
        COALESCE(SUM(
            CASE 
                WHEN b.end_time IS NOT NULL THEN b.end_time - b.start_time
                ELSE INTERVAL '0'
            END
        ), INTERVAL '0') AS total_break_duration
    FROM time_entries te
    JOIN employees e ON te.employee_id = e.id
    LEFT JOIN breaks b ON b.time_entry_id = te.id
    GROUP BY te.id, e.first_name, e.last_name, e.role, 
             te.start_time, te.end_time, te.status, 
             te.start_location, te.end_location
    ORDER BY te.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON employees FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON time_entries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON locations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON breaks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON system_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- ==========================================
-- 13. ADMIN MAESTRO INICIAL
-- ==========================================
-- PIN: @18181 (cámbialo después desde el panel)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM employees WHERE pin_text = '@18181' OR invite_code = 'CORP-18EC') THEN
        INSERT INTO employees (first_name, last_name, pin_text, role, verified, invite_code)
        VALUES ('Admin', 'Maestro', '@18181', 'admin', true, 'CORP-18EC');
    END IF;
END $$;

-- ============================================================
-- ✅ LISTO! Inicia sesión con PIN: @18181
-- ============================================================
