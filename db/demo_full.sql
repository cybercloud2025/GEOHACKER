-- ============================================================================
-- GEOHACKER — INSTALACIÓN COMPLETA DE LA DEMO (fichero generado)
-- ============================================================================
-- No edites este fichero: se genera con `npm run db:demo` a partir de
--   db/schema.sql
--   db/demo_seed.sql
-- Edita esas fuentes y vuelve a generarlo.
--
-- USO
--   1. Crea un proyecto de Supabase NUEVO Y EXCLUSIVO para la demo.
--      Los datos de prueba no deben convivir con datos reales.
--   2. Pega este fichero entero en su SQL Editor y ejecútalo.
--   3. Copia la URL del proyecto y su clave anónima en /configuracion.
--
-- Al terminar verás en los mensajes el resumen de la instalación y la lista
-- de cuentas con las que entrar.
-- ============================================================================



-- ==========================================================================
-- INICIO DE db/schema.sql
-- ==========================================================================

-- ============================================================================
-- GEOHACKER — ESQUEMA ÚNICO DE PRODUCCIÓN
-- ============================================================================
-- Este fichero es la ÚNICA fuente de verdad de la base de datos.
-- Es idempotente: se puede ejecutar sobre una base de datos nueva o existente.
--
-- Modelo de seguridad:
--   * Los roles `anon` y `authenticated` NO tienen ningún acceso a las tablas.
--   * Todo pasa por funciones SECURITY DEFINER que exigen un token de sesión
--     y aplican el aislamiento por empresa (admin_id).
--   * El token lo emite login_with_pin() y se guarda hasheado (sha256).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. LIMPIEZA DE VERSIONES ANTERIORES
-- ---------------------------------------------------------------------------
-- Los 29 scripts sueltos que habia en la raiz dejaron multiples versiones de la
-- misma funcion con firmas distintas. Eso es peligroso: la vieja clock_in(UUID,
-- JSONB) seguiria siendo invocable por cualquiera y saltandose la sesion. Aqui
-- se eliminan TODAS las sobrecargas de esos nombres antes de recrearlos.
DO $legacy$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
                -- nombres que esta version vuelve a crear
                'login_with_pin', 'register_employee', 'register_admin',
                'logout', 'get_me', 'get_my_status', 'get_public_settings',
                'clock_in', 'clock_out', 'start_break', 'end_break',
                'record_location', 'trigger_hash_pin',
                '_token_hash', '_session_ttl', '_session_employee',
                '_session_admin', '_session_master', '_admin_can_manage',
                '_issue_session', '_employee_json', '_client_ip',
                '_check_pin_format',
                'admin_list_users', 'admin_list_admins',
                'admin_list_assignable_admins', 'admin_get_history',
                'admin_get_time_entry', 'admin_get_active_user_ids',
                'admin_get_live_locations', 'admin_create_user',
                'admin_update_employee', 'admin_verify_employee',
                'admin_assign_employee', 'admin_set_role',
                'admin_delete_employee', 'admin_set_registration_enabled',
                'admin_impersonate', 'admin_regenerate_invite_code',
                -- nombres heredados que ya no existen en esta version
                'register_employee_with_code', 'get_all_time_entries',
                'get_admin_live_data_v7', 'get_active_locations_v5',
                'get_live_locations', 'fetch_admin_map_data', 'test_rpc',
                'hash_employee_pin', 'sync_employee_pin_hash'
          )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;
END
$legacy$;

-- ---------------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employees (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    pin_text      TEXT UNIQUE,
    pin_hash      TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
    verified      BOOLEAN DEFAULT FALSE,
    is_master     BOOLEAN NOT NULL DEFAULT FALSE,
    employee_email TEXT,
    avatar_url    TEXT,
    invite_code   TEXT UNIQUE,
    admin_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
    company_name  TEXT,
    fiscal_id     TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Columnas añadidas por versiones posteriores (idempotente sobre BD existentes)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_master    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fiscal_id    TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS time_entries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time     TIMESTAMPTZ,
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'break')),
    start_location JSONB,
    end_location JSONB,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    accuracy      DOUBLE PRECISION,
    heading       DOUBLE PRECISION,
    speed         DOUBLE PRECISION,
    battery_level INTEGER,
    timestamp     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breaks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    start_time    TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time      TIMESTAMPTZ,
    reason        TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL DEFAULT 'true'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sesiones: sustituyen a la "confianza en el cliente" que había antes.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    -- Cuando un maestro suplanta a otro usuario, guardamos quién lo hizo.
    acting_for  UUID REFERENCES employees(id) ON DELETE CASCADE
);

-- Control de fuerza bruta sobre el PIN.
CREATE TABLE IF NOT EXISTS login_attempts (
    ip          TEXT PRIMARY KEY,
    fails       INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_settings (key, value)
VALUES ('registrations_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. ÍNDICES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_open     ON time_entries(employee_id) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_role        ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_admin       ON employees(admin_id);
CREATE INDEX IF NOT EXISTS idx_employees_invite      ON employees(invite_code);
CREATE INDEX IF NOT EXISTS idx_locations_entry_time  ON locations(time_entry_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_breaks_entry          ON breaks(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_sessions_employee     ON sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires      ON sessions(expires_at);

-- ---------------------------------------------------------------------------
-- 3. TRIGGER: hash automático del PIN
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_hash_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (NEW.pin_text IS DISTINCT FROM OLD.pin_text) THEN
        IF NEW.pin_text IS NOT NULL THEN
            NEW.pin_hash := crypt(NEW.pin_text, gen_salt('bf'));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_pin ON employees;
CREATE TRIGGER trg_hash_pin
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION trigger_hash_pin();

-- ---------------------------------------------------------------------------
-- 4. HELPERS DE SESIÓN (privados: no se conceden a anon)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _token_hash(p_token TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$ SELECT encode(digest(p_token, 'sha256'), 'hex'); $$;

-- Duración de sesión (deslizante).
CREATE OR REPLACE FUNCTION _session_ttl()
RETURNS INTERVAL
LANGUAGE sql IMMUTABLE
AS $$ SELECT INTERVAL '12 hours'; $$;

-- Resuelve el token a un empleado. Lanza excepción si es inválido o caducó.
-- Además renueva la caducidad (sesión deslizante).
CREATE OR REPLACE FUNCTION _session_employee(p_token TEXT)
RETURNS employees
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp employees;
    v_hash TEXT;
BEGIN
    IF p_token IS NULL OR length(p_token) < 20 THEN
        RAISE EXCEPTION 'SESION_INVALIDA' USING ERRCODE = '28000';
    END IF;

    v_hash := _token_hash(p_token);

    SELECT e.* INTO v_emp
    FROM sessions s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.token_hash = v_hash
      AND s.expires_at > now()
      AND e.is_active = true;

    IF v_emp.id IS NULL THEN
        RAISE EXCEPTION 'SESION_INVALIDA' USING ERRCODE = '28000';
    END IF;

    UPDATE sessions
       SET expires_at = now() + _session_ttl()
     WHERE token_hash = v_hash;

    RETURN v_emp;
END;
$$;

-- Igual que el anterior pero exige rol de administrador verificado.
CREATE OR REPLACE FUNCTION _session_admin(p_token TEXT)
RETURNS employees
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp employees;
BEGIN
    v_emp := _session_employee(p_token);

    IF v_emp.role <> 'admin' THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;

    IF NOT v_emp.verified AND NOT v_emp.is_master THEN
        RAISE EXCEPTION 'CUENTA_PENDIENTE_DE_VALIDACION' USING ERRCODE = '42501';
    END IF;

    RETURN v_emp;
END;
$$;

-- Exige rol de Administrador Maestro.
CREATE OR REPLACE FUNCTION _session_master(p_token TEXT)
RETURNS employees
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp employees;
BEGIN
    v_emp := _session_admin(p_token);
    IF NOT v_emp.is_master THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;
    RETURN v_emp;
END;
$$;

-- ¿Puede este admin gestionar a este empleado?
CREATE OR REPLACE FUNCTION _admin_can_manage(p_admin employees, p_target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target employees;
BEGIN
    SELECT * INTO v_target FROM employees WHERE id = p_target_id;
    IF v_target.id IS NULL THEN RETURN FALSE; END IF;

    -- El maestro gestiona a todo el mundo menos a sí mismo vía estas rutas.
    IF p_admin.is_master THEN RETURN TRUE; END IF;

    -- Un admin normal solo gestiona a SUS empleados (nunca a otros admins).
    RETURN v_target.admin_id = p_admin.id AND v_target.role = 'employee';
END;
$$;

-- Crea una sesión y devuelve el token en claro (solo se ve aquí una vez).
CREATE OR REPLACE FUNCTION _issue_session(p_employee_id UUID, p_acting_for UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token TEXT;
BEGIN
    v_token := encode(gen_random_bytes(32), 'hex');

    DELETE FROM sessions WHERE expires_at < now();

    INSERT INTO sessions (token_hash, employee_id, expires_at, acting_for)
    VALUES (_token_hash(v_token), p_employee_id, now() + _session_ttl(), p_acting_for);

    RETURN v_token;
END;
$$;

-- Serializa un empleado para el cliente. NUNCA incluye pin_hash.
CREATE OR REPLACE FUNCTION _employee_json(p_emp employees)
RETURNS JSONB
LANGUAGE sql IMMUTABLE
AS $$
    SELECT jsonb_build_object(
        'id',             p_emp.id,
        'first_name',     p_emp.first_name,
        'last_name',      p_emp.last_name,
        'role',           p_emp.role,
        'is_master',      p_emp.is_master,
        'verified',       p_emp.verified,
        'invite_code',    p_emp.invite_code,
        'admin_id',       p_emp.admin_id,
        'employee_email', p_emp.employee_email,
        'avatar_url',     p_emp.avatar_url,
        'company_name',   p_emp.company_name,
        'fiscal_id',      p_emp.fiscal_id
    );
$$;

-- IP del llamante, si PostgREST la expone.
CREATE OR REPLACE FUNCTION _client_ip()
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_hdrs TEXT;
BEGIN
    v_hdrs := current_setting('request.headers', true);
    IF v_hdrs IS NULL THEN RETURN NULL; END IF;
    RETURN split_part(coalesce(v_hdrs::json ->> 'x-forwarded-for', ''), ',', 1);
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC PÚBLICAS (sin token)
-- ---------------------------------------------------------------------------

-- Ajustes que la pantalla de login necesita ANTES de autenticarse.
CREATE OR REPLACE FUNCTION get_public_settings()
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'registrations_enabled',
        coalesce((SELECT value FROM system_settings WHERE key = 'registrations_enabled'), 'true'::jsonb)
    );
$$;

-- Login por PIN. Devuelve el empleado + token de sesión.
-- Cambios frente a la versión anterior:
--   * Se elimina el fallback `pin_text = p_pin` (anulaba el bcrypt).
--   * Se limita la fuerza bruta por IP.
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp    employees;
    v_token  TEXT;
    v_ip     TEXT;
    v_att    login_attempts;
BEGIN
    v_ip := _client_ip();

    -- IMPORTANTE: esta función devuelve los fallos como un campo 'error' del
    -- JSON en vez de lanzar una excepción. Un RAISE aborta la transacción de la
    -- llamada, y eso revertiría también el INSERT del contador de intentos, con
    -- lo que la protección contra fuerza bruta nunca llegaría a guardarse.
    IF v_ip IS NOT NULL AND v_ip <> '' THEN
        SELECT * INTO v_att FROM login_attempts WHERE ip = v_ip;
        IF v_att.locked_until IS NOT NULL AND v_att.locked_until > now() THEN
            RETURN jsonb_build_object('error', 'DEMASIADOS_INTENTOS');
        END IF;
    END IF;

    SELECT * INTO v_emp
    FROM employees
    WHERE is_active = true
      AND pin_hash = crypt(p_pin, pin_hash)
    LIMIT 1;

    IF v_emp.id IS NULL THEN
        IF v_ip IS NOT NULL AND v_ip <> '' THEN
            INSERT INTO login_attempts (ip, fails, updated_at)
            VALUES (v_ip, 1, now())
            ON CONFLICT (ip) DO UPDATE SET
                fails = CASE WHEN login_attempts.updated_at < now() - INTERVAL '15 minutes'
                             THEN 1 ELSE login_attempts.fails + 1 END,
                locked_until = CASE WHEN login_attempts.fails + 1 >= 10
                                    THEN now() + INTERVAL '15 minutes' ELSE NULL END,
                updated_at = now();
        END IF;
        RETURN jsonb_build_object('error', 'CREDENCIALES_INVALIDAS');
    END IF;

    -- Un administrador no maestro debe estar validado.
    IF v_emp.role = 'admin' AND NOT v_emp.verified AND NOT v_emp.is_master THEN
        RETURN jsonb_build_object('error', 'CUENTA_PENDIENTE_DE_VALIDACION');
    END IF;

    IF v_ip IS NOT NULL AND v_ip <> '' THEN
        DELETE FROM login_attempts WHERE ip = v_ip;
    END IF;

    v_token := _issue_session(v_emp.id);

    RETURN _employee_json(v_emp) || jsonb_build_object('token', v_token);
END;
$$;

-- Alta pública de EMPLEADO con código de organización.
CREATE OR REPLACE FUNCTION register_employee(
    p_first_name  TEXT,
    p_last_name   TEXT,
    p_pin         TEXT,
    p_email       TEXT DEFAULT NULL,
    p_avatar_url  TEXT DEFAULT NULL,
    p_invite_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_admin  employees;
    v_emp    employees;
    v_token  TEXT;
BEGIN
    IF NOT coalesce((SELECT value FROM system_settings WHERE key = 'registrations_enabled'), 'true'::jsonb)::boolean THEN
        RAISE EXCEPTION 'El registro de nuevos usuarios está desactivado.';
    END IF;

    IF p_pin !~ '^\d{4}$' THEN
        RAISE EXCEPTION 'El PIN de empleado debe tener exactamente 4 dígitos.';
    END IF;

    -- El código es opcional. Si se indica, el alta entra directamente en esa
    -- organización; si no, queda sin asignar y es el Administrador Maestro
    -- quien la asigna desde el panel ("Validar y Asignar Usuario").
    IF p_invite_code IS NOT NULL AND btrim(p_invite_code) <> '' THEN
        SELECT * INTO v_admin FROM employees
         WHERE upper(invite_code) = upper(btrim(p_invite_code))
           AND role = 'admin' AND is_active = true
         LIMIT 1;

        IF v_admin.id IS NULL THEN
            RAISE EXCEPTION 'Código de organización inválido.';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM employees WHERE pin_text = p_pin AND is_active = true) THEN
        RAISE EXCEPTION 'Este PIN ya está en uso por otro usuario.';
    END IF;

    -- v_admin.id es NULL si no se aportó código: el usuario queda pendiente
    -- de que el maestro lo asigne a una organización.
    INSERT INTO employees (first_name, last_name, pin_text, pin_hash, role,
                           employee_email, avatar_url, admin_id, verified)
    VALUES (btrim(p_first_name), btrim(p_last_name), p_pin, 'x', 'employee',
            nullif(btrim(coalesce(p_email, '')), ''), p_avatar_url, v_admin.id, false)
    RETURNING * INTO v_emp;

    v_token := _issue_session(v_emp.id);

    -- admin_email lo usa el cliente para avisar por EmailJS de que hay un alta
    -- pendiente de validar. Es el email del admin de SU propia organización.
    RETURN _employee_json(v_emp)
        || jsonb_build_object('token', v_token, 'admin_email', v_admin.employee_email);
END;
$$;

-- Alta pública de ADMINISTRADOR (pantalla /admin-register). Queda sin validar.
CREATE OR REPLACE FUNCTION register_admin(
    p_first_name   TEXT,
    p_last_name    TEXT,
    p_pin          TEXT,
    p_email        TEXT DEFAULT NULL,
    p_avatar_url   TEXT DEFAULT NULL,
    p_company_name TEXT DEFAULT NULL,
    p_fiscal_id    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp         employees;
    v_code        TEXT;
    v_master_mail TEXT;
BEGIN
    IF p_pin !~ '^@\d{5}$' THEN
        RAISE EXCEPTION 'El PIN de administrador debe tener el formato @ + 5 dígitos (ej: @12345).';
    END IF;

    IF EXISTS (SELECT 1 FROM employees WHERE pin_text = p_pin AND is_active = true) THEN
        RAISE EXCEPTION 'Este PIN ya está en uso por otro usuario.';
    END IF;

    -- Código de organización único.
    LOOP
        v_code := 'CORP-' || upper(substring(md5(random()::text), 1, 4));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM employees WHERE invite_code = v_code);
    END LOOP;

    INSERT INTO employees (first_name, last_name, pin_text, pin_hash, role, verified,
                           employee_email, avatar_url, invite_code, company_name, fiscal_id)
    VALUES (btrim(p_first_name), btrim(p_last_name), p_pin, 'x', 'admin', false,
            nullif(btrim(coalesce(p_email, '')), ''), p_avatar_url, v_code,
            nullif(btrim(coalesce(p_company_name, '')), ''),
            nullif(btrim(coalesce(p_fiscal_id, '')), ''))
    RETURNING * INTO v_emp;

    SELECT employee_email INTO v_master_mail FROM employees WHERE is_master = true LIMIT 1;

    -- Sin token: no puede entrar hasta que el maestro lo valide.
    RETURN _employee_json(v_emp) || jsonb_build_object('admin_email', v_master_mail);
END;
$$;

-- Cierre de sesión: invalida el token en servidor.
CREATE OR REPLACE FUNCTION logout(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    DELETE FROM sessions WHERE token_hash = _token_hash(p_token);
END;
$$;

-- Refresca los datos del usuario de la sesión (por si el admin los cambió).
CREATE OR REPLACE FUNCTION get_me(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_emp employees;
BEGIN
    v_emp := _session_employee(p_token);
    RETURN _employee_json(v_emp);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC DE EMPLEADO (requieren token)
-- ---------------------------------------------------------------------------

-- Estado del turno abierto del usuario de la sesión.
CREATE OR REPLACE FUNCTION get_my_status(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp   employees;
    v_entry time_entries;
    v_break_id UUID;
BEGIN
    v_emp := _session_employee(p_token);

    SELECT * INTO v_entry FROM time_entries
     WHERE employee_id = v_emp.id AND end_time IS NULL
     ORDER BY start_time DESC LIMIT 1;

    IF v_entry.id IS NULL THEN
        RETURN jsonb_build_object('status', 'idle');
    END IF;

    SELECT id INTO v_break_id FROM breaks
     WHERE time_entry_id = v_entry.id AND end_time IS NULL
     ORDER BY start_time DESC LIMIT 1;

    RETURN jsonb_build_object(
        'status',          v_entry.status,
        'current_shift_id', v_entry.id,
        'current_break_id', v_break_id,
        'start_time',      v_entry.start_time
    );
END;
$$;

CREATE OR REPLACE FUNCTION clock_in(p_token TEXT, p_location JSONB DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp employees;
    v_id  UUID;
BEGIN
    v_emp := _session_employee(p_token);

    SELECT id INTO v_id FROM time_entries
     WHERE employee_id = v_emp.id AND end_time IS NULL LIMIT 1;

    -- Idempotente: si ya hay turno abierto devolvemos ese en vez de reventar.
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    INSERT INTO time_entries (employee_id, start_time, status, start_location)
    VALUES (v_emp.id, now(), 'active', p_location)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION clock_out(p_token TEXT, p_location JSONB DEFAULT NULL, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp      employees;
    v_shift_id UUID;
BEGIN
    v_emp := _session_employee(p_token);

    SELECT id INTO v_shift_id FROM time_entries
     WHERE employee_id = v_emp.id AND end_time IS NULL LIMIT 1;

    -- Idempotente: si no hay turno abierto, no es un error.
    IF v_shift_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE breaks SET end_time = now()
     WHERE time_entry_id = v_shift_id AND end_time IS NULL;

    UPDATE time_entries
       SET end_time = now(), status = 'completed',
           end_location = p_location, notes = p_notes
     WHERE id = v_shift_id;
END;
$$;

CREATE OR REPLACE FUNCTION start_break(p_token TEXT, p_reason TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp      employees;
    v_shift_id UUID;
    v_break_id UUID;
BEGIN
    v_emp := _session_employee(p_token);

    SELECT id INTO v_shift_id FROM time_entries
     WHERE employee_id = v_emp.id AND end_time IS NULL LIMIT 1;

    IF v_shift_id IS NULL THEN
        RAISE EXCEPTION 'No hay turno activo para pausar.';
    END IF;

    SELECT id INTO v_break_id FROM breaks
     WHERE time_entry_id = v_shift_id AND end_time IS NULL LIMIT 1;

    IF v_break_id IS NULL THEN
        INSERT INTO breaks (time_entry_id, start_time, reason)
        VALUES (v_shift_id, now(), p_reason)
        RETURNING id INTO v_break_id;
    END IF;

    UPDATE time_entries SET status = 'break' WHERE id = v_shift_id;

    RETURN v_break_id;
END;
$$;

CREATE OR REPLACE FUNCTION end_break(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp      employees;
    v_shift_id UUID;
BEGIN
    v_emp := _session_employee(p_token);

    SELECT id INTO v_shift_id FROM time_entries
     WHERE employee_id = v_emp.id AND end_time IS NULL LIMIT 1;

    IF v_shift_id IS NULL THEN
        RAISE EXCEPTION 'No hay turno activo.';
    END IF;

    UPDATE breaks SET end_time = now()
     WHERE time_entry_id = v_shift_id AND end_time IS NULL;

    UPDATE time_entries SET status = 'active' WHERE id = v_shift_id;
END;
$$;

-- Registra un punto GPS. El turno se deduce del servidor: el cliente ya no
-- puede escribir ubicaciones en el turno de otra persona.
CREATE OR REPLACE FUNCTION record_location(
    p_token    TEXT,
    p_latitude  DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_accuracy  DOUBLE PRECISION DEFAULT NULL,
    p_heading   DOUBLE PRECISION DEFAULT NULL,
    p_speed     DOUBLE PRECISION DEFAULT NULL,
    p_battery   INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_emp      employees;
    v_shift_id UUID;
BEGIN
    v_emp := _session_employee(p_token);

    IF p_latitude IS NULL OR p_longitude IS NULL
       OR p_latitude  NOT BETWEEN -90  AND 90
       OR p_longitude NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'Coordenadas fuera de rango.';
    END IF;

    SELECT id INTO v_shift_id FROM time_entries
     WHERE employee_id = v_emp.id AND end_time IS NULL LIMIT 1;

    IF v_shift_id IS NULL THEN
        RETURN; -- sin turno abierto no se guardan posiciones
    END IF;

    INSERT INTO locations (employee_id, time_entry_id, latitude, longitude,
                           accuracy, heading, speed, battery_level)
    VALUES (v_emp.id, v_shift_id, p_latitude, p_longitude,
            p_accuracy, p_heading, p_speed,
            CASE WHEN p_battery BETWEEN 0 AND 100 THEN p_battery ELSE NULL END);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC DE ADMINISTRACIÓN (requieren token de admin; aíslan por empresa)
-- ---------------------------------------------------------------------------

-- Empleados que gestiona el admin de la sesión.
-- El maestro ve además cualquier alta pendiente de validar.
CREATE OR REPLACE FUNCTION admin_list_users(p_token TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin employees;
BEGIN
    v_admin := _session_admin(p_token);

    RETURN QUERY
    SELECT to_jsonb(e) - 'pin_hash'
    FROM employees e
    WHERE e.role <> 'admin'
      AND (
            e.admin_id = v_admin.id
            OR (v_admin.is_master AND e.verified = false)
          )
    ORDER BY e.created_at DESC;
END;
$$;

-- Lista de administradores. Solo el maestro.
CREATE OR REPLACE FUNCTION admin_list_admins(p_token TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    PERFORM _session_master(p_token);

    RETURN QUERY
    SELECT to_jsonb(e) - 'pin_hash'
    FROM employees e
    WHERE e.role = 'admin'
    ORDER BY e.created_at DESC;
END;
$$;

-- Administradores a los que se puede asignar un empleado (excluye al maestro).
CREATE OR REPLACE FUNCTION admin_list_assignable_admins(p_token TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    PERFORM _session_master(p_token);

    RETURN QUERY
    SELECT jsonb_build_object(
        'id', e.id, 'first_name', e.first_name, 'last_name', e.last_name,
        'employee_email', e.employee_email, 'invite_code', e.invite_code,
        'company_name', e.company_name
    )
    FROM employees e
    WHERE e.role = 'admin' AND e.is_master = false AND e.is_active = true
    ORDER BY e.first_name ASC;
END;
$$;

-- Historial de fichajes de los empleados del admin de la sesión.
CREATE OR REPLACE FUNCTION admin_get_history(p_token TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin employees;
BEGIN
    v_admin := _session_admin(p_token);

    RETURN QUERY
    SELECT jsonb_build_object(
        'id',                  te.id,
        'employee_id',         e.id,
        'employee_name',       e.first_name || ' ' || e.last_name,
        'employee_role',       e.role,
        'start_time',          te.start_time,
        'end_time',            te.end_time,
        'status',              te.status,
        'start_location',      te.start_location,
        'end_location',        te.end_location,
        'breaks_count',        count(b.id),
        'total_break_duration', jsonb_build_object(
            'hours', extract(epoch FROM coalesce(sum(b.end_time - b.start_time), INTERVAL '0')) / 3600
        )
    )
    FROM time_entries te
    JOIN employees e ON e.id = te.employee_id
    LEFT JOIN breaks b ON b.time_entry_id = te.id
    WHERE e.role <> 'admin'
      AND (v_admin.is_master OR e.admin_id = v_admin.id)
    GROUP BY te.id, e.id
    ORDER BY te.start_time DESC;
END;
$$;

-- Un único fichaje (pantalla de mapa de detalle).
CREATE OR REPLACE FUNCTION admin_get_time_entry(p_token TEXT, p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_admin  employees;
    v_result JSONB;
BEGIN
    v_admin := _session_admin(p_token);

    SELECT jsonb_build_object(
        'id',             te.id,
        'employee_name',  e.first_name || ' ' || e.last_name,
        'start_time',     te.start_time,
        'end_time',       te.end_time,
        'status',         te.status,
        'start_location', te.start_location,
        'end_location',   te.end_location
    ) INTO v_result
    FROM time_entries te
    JOIN employees e ON e.id = te.employee_id
    WHERE te.id = p_entry_id
      AND (v_admin.is_master OR e.admin_id = v_admin.id);

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;

    RETURN v_result;
END;
$$;

-- IDs de empleados con turno abierto (incluye los que están en pausa).
CREATE OR REPLACE FUNCTION admin_get_active_user_ids(p_token TEXT)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin employees;
BEGIN
    v_admin := _session_admin(p_token);

    RETURN QUERY
    SELECT DISTINCT te.employee_id
    FROM time_entries te
    JOIN employees e ON e.id = te.employee_id
    WHERE te.end_time IS NULL
      AND (v_admin.is_master OR e.admin_id = v_admin.id);
END;
$$;

-- Mapa en vivo: última posición de cada turno abierto, en UNA sola consulta.
-- Sustituye al patrón N+1 que hacía una query por empleado cada 20 segundos.
CREATE OR REPLACE FUNCTION admin_get_live_locations(p_token TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin employees;
BEGIN
    v_admin := _session_admin(p_token);

    RETURN QUERY
    SELECT jsonb_build_object(
        'employee_id',      e.id,
        'first_name',       e.first_name,
        'last_name',        e.last_name,
        'avatar_url',       e.avatar_url,
        'latitude',         l.latitude,
        'longitude',        l.longitude,
        'accuracy',         l.accuracy,
        'heading',          l.heading,
        'speed',            l.speed,
        'battery_level',    l.battery_level,
        'last_ping',        coalesce(l.timestamp, te.start_time),
        'shift_start_time', te.start_time,
        'status',           te.status,
        'has_gps',          (l.latitude IS NOT NULL)
    )
    FROM time_entries te
    JOIN employees e ON e.id = te.employee_id
    LEFT JOIN LATERAL (
        SELECT loc.latitude, loc.longitude, loc.accuracy, loc.heading,
               loc.speed, loc.battery_level, loc.timestamp
        FROM locations loc
        WHERE loc.time_entry_id = te.id
        ORDER BY loc.timestamp DESC
        LIMIT 1
    ) l ON true
    WHERE te.end_time IS NULL
      AND e.role <> 'admin'
      AND (v_admin.is_master OR e.admin_id = v_admin.id);
END;
$$;

-- Valida el formato del PIN segun a quien se aplica.
CREATE OR REPLACE FUNCTION _check_pin_format(p_pin TEXT, p_target employees)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_target.is_master THEN
        IF p_pin !~ '^\d{4}$' AND p_pin !~ '^\d{8}$' AND p_pin !~ '^@\d{5}$' THEN
            RAISE EXCEPTION 'El Master Admin debe tener 8 dígitos, 4 dígitos o formato @+5.';
        END IF;
    ELSIF p_target.role = 'admin' OR p_pin LIKE '@%' THEN
        IF p_pin !~ '^@\d{5}$' THEN
            RAISE EXCEPTION 'El PIN de administrador DEBE tener el formato @ + 5 dígitos (ej: @12345).';
        END IF;
    ELSE
        IF p_pin !~ '^\d{4}$' THEN
            RAISE EXCEPTION 'El PIN debe tener 4 dígitos.';
        END IF;
    END IF;
END;
$$;

-- Alta de empleado hecha por un admin: nace ya verificado y en su empresa.
CREATE OR REPLACE FUNCTION admin_create_user(
    p_token      TEXT,
    p_first_name TEXT,
    p_last_name  TEXT,
    p_pin        TEXT,
    p_email      TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_admin employees;
    v_emp   employees;
BEGIN
    v_admin := _session_admin(p_token);

    IF p_pin !~ '^\d{4}$' THEN
        RAISE EXCEPTION 'El PIN debe tener 4 dígitos.';
    END IF;

    IF EXISTS (SELECT 1 FROM employees WHERE pin_text = p_pin AND is_active = true) THEN
        RAISE EXCEPTION 'Este PIN ya está en uso por otro usuario.';
    END IF;

    INSERT INTO employees (first_name, last_name, pin_text, pin_hash, role,
                           employee_email, avatar_url, admin_id, verified)
    VALUES (btrim(p_first_name), btrim(p_last_name), p_pin, 'x', 'employee',
            nullif(btrim(coalesce(p_email, '')), ''), p_avatar_url, v_admin.id, true)
    RETURNING * INTO v_emp;

    RETURN _employee_json(v_emp) || jsonb_build_object('invite_code', v_admin.invite_code);
END;
$$;

-- Edicion de datos de perfil (incluido el PIN).
CREATE OR REPLACE FUNCTION admin_update_employee(
    p_token        TEXT,
    p_id           UUID,
    p_first_name   TEXT,
    p_last_name    TEXT,
    p_email        TEXT DEFAULT NULL,
    p_pin          TEXT DEFAULT NULL,
    p_company_name TEXT DEFAULT NULL,
    p_fiscal_id    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_admin  employees;
    v_target employees;
BEGIN
    v_admin := _session_admin(p_token);

    SELECT * INTO v_target FROM employees WHERE id = p_id;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    IF NOT _admin_can_manage(v_admin, p_id) THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;

    IF p_pin IS NOT NULL AND btrim(p_pin) <> '' THEN
        PERFORM _check_pin_format(btrim(p_pin), v_target);
        IF EXISTS (SELECT 1 FROM employees
                    WHERE pin_text = btrim(p_pin) AND id <> p_id AND is_active = true) THEN
            RAISE EXCEPTION 'Este PIN ya está en uso por otro usuario.';
        END IF;
    END IF;

    UPDATE employees SET
        first_name     = coalesce(nullif(btrim(p_first_name), ''), first_name),
        last_name      = coalesce(nullif(btrim(p_last_name), ''), last_name),
        employee_email = nullif(btrim(coalesce(p_email, '')), ''),
        pin_text       = CASE WHEN p_pin IS NOT NULL AND btrim(p_pin) <> ''
                              THEN btrim(p_pin) ELSE pin_text END,
        company_name   = nullif(btrim(coalesce(p_company_name, '')), ''),
        fiscal_id      = nullif(btrim(coalesce(p_fiscal_id, '')), '')
    WHERE id = p_id
    RETURNING * INTO v_target;

    -- Cambiar el PIN cierra las sesiones abiertas de ese usuario.
    IF p_pin IS NOT NULL AND btrim(p_pin) <> '' THEN
        DELETE FROM sessions WHERE employee_id = p_id;
    END IF;

    RETURN _employee_json(v_target);
END;
$$;

-- Validar un alta pendiente.
CREATE OR REPLACE FUNCTION admin_verify_employee(p_token TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_admin  employees;
    v_target employees;
    v_code   TEXT;
BEGIN
    v_admin := _session_admin(p_token);

    SELECT * INTO v_target FROM employees WHERE id = p_id;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    -- Validar a un ADMINISTRADOR es competencia exclusiva del maestro.
    IF v_target.role = 'admin' AND NOT v_admin.is_master THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;

    IF v_target.role <> 'admin' AND NOT _admin_can_manage(v_admin, p_id) THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;

    -- Un admin sin codigo de organizacion valido recibe uno al validarse.
    IF v_target.role = 'admin'
       AND (v_target.invite_code IS NULL OR position('?' in v_target.invite_code) > 0) THEN
        LOOP
            v_code := 'CORP-' || upper(substring(md5(random()::text), 1, 4));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM employees WHERE invite_code = v_code);
        END LOOP;
    END IF;

    UPDATE employees
       SET verified = true,
           invite_code = coalesce(v_code, invite_code)
     WHERE id = p_id
    RETURNING * INTO v_target;

    RETURN _employee_json(v_target);
END;
$$;

-- Asignar un empleado a un administrador (y validarlo). Solo el maestro.
CREATE OR REPLACE FUNCTION admin_assign_employee(p_token TEXT, p_id UUID, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target employees;
BEGIN
    PERFORM _session_master(p_token);

    IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'El destino no es un administrador válido.';
    END IF;

    UPDATE employees
       SET admin_id = p_admin_id, verified = true
     WHERE id = p_id AND role <> 'admin'
    RETURNING * INTO v_target;

    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    RETURN _employee_json(v_target);
END;
$$;

-- Ascender / degradar. Solo el maestro.
CREATE OR REPLACE FUNCTION admin_set_role(p_token TEXT, p_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_master employees;
    v_target employees;
    v_code   TEXT;
BEGIN
    v_master := _session_master(p_token);

    IF p_role NOT IN ('admin', 'employee') THEN
        RAISE EXCEPTION 'Rol no válido.';
    END IF;

    IF p_id = v_master.id THEN
        RAISE EXCEPTION 'No puedes cambiar tu propio rol.';
    END IF;

    SELECT * INTO v_target FROM employees WHERE id = p_id;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    IF v_target.is_master THEN
        RAISE EXCEPTION 'No se puede degradar al Administrador Maestro.';
    END IF;

    IF p_role = 'admin' AND v_target.invite_code IS NULL THEN
        LOOP
            v_code := 'CORP-' || upper(substring(md5(random()::text), 1, 4));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM employees WHERE invite_code = v_code);
        END LOOP;
    END IF;

    UPDATE employees
       SET role = p_role,
           invite_code = coalesce(v_code, invite_code)
     WHERE id = p_id
    RETURNING * INTO v_target;

    DELETE FROM sessions WHERE employee_id = p_id;

    RETURN _employee_json(v_target);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_employee(p_token TEXT, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_admin  employees;
    v_target employees;
BEGIN
    v_admin := _session_admin(p_token);

    SELECT * INTO v_target FROM employees WHERE id = p_id;
    IF v_target.id IS NULL THEN RETURN; END IF;

    IF v_target.is_master THEN
        RAISE EXCEPTION 'No se puede eliminar al Administrador Maestro.';
    END IF;

    IF p_id = v_admin.id THEN
        RAISE EXCEPTION 'No puedes eliminarte a ti mismo.';
    END IF;

    -- Borrar un administrador es competencia exclusiva del maestro.
    IF v_target.role = 'admin' AND NOT v_admin.is_master THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;

    IF v_target.role <> 'admin' AND NOT _admin_can_manage(v_admin, p_id) THEN
        RAISE EXCEPTION 'PERMISO_DENEGADO' USING ERRCODE = '42501';
    END IF;

    DELETE FROM employees WHERE id = p_id;
END;
$$;

-- Interruptor global de registros. Solo el maestro.
CREATE OR REPLACE FUNCTION admin_set_registration_enabled(p_token TEXT, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    PERFORM _session_master(p_token);

    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('registrations_enabled', to_jsonb(p_enabled), now())
    ON CONFLICT (key) DO UPDATE SET value = to_jsonb(p_enabled), updated_at = now();
END;
$$;

-- Suplantacion: ahora la valida el servidor y emite una sesion real acotada.
CREATE OR REPLACE FUNCTION admin_impersonate(p_token TEXT, p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_master employees;
    v_target employees;
    v_token  TEXT;
BEGIN
    v_master := _session_master(p_token);

    SELECT * INTO v_target FROM employees WHERE id = p_target_id AND is_active = true;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    v_token := _issue_session(v_target.id, v_master.id);

    RETURN _employee_json(v_target) || jsonb_build_object('token', v_token);
END;
$$;


-- Regenerar el codigo de organizacion de un administrador. Solo el maestro.
-- El codigo lo genera el servidor y comprueba que sea unico; antes se sorteaba
-- en el navegador con Math.random() y se enviaba como un UPDATE suelto.
CREATE OR REPLACE FUNCTION admin_regenerate_invite_code(p_token TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_target employees;
    v_code   TEXT;
BEGIN
    PERFORM _session_master(p_token);

    SELECT * INTO v_target FROM employees WHERE id = p_id AND role = 'admin';
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Administrador no encontrado.';
    END IF;

    LOOP
        v_code := 'CORP-' || upper(substring(md5(random()::text), 1, 4));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM employees WHERE invite_code = v_code);
    END LOOP;

    UPDATE employees SET invite_code = v_code WHERE id = p_id
    RETURNING * INTO v_target;

    RETURN _employee_json(v_target);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. CIERRE DE PERMISOS
-- ---------------------------------------------------------------------------
-- Aqui es donde se corrige el agujero principal: `anon` (la clave publica que
-- viaja en el bundle del navegador) deja de tener cualquier acceso a las
-- tablas. Solo puede ejecutar las funciones listadas abajo, y todas exigen un
-- token de sesion valido salvo las tres publicas de login/registro.

-- 8.1 Fuera las politicas heredadas de los scripts antiguos ("Permiso Total
--     Publico", "Allow all for anon", etc.).
DO $policies$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('employees', 'time_entries', 'locations', 'breaks',
                            'system_settings', 'sessions', 'login_attempts')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END
$policies$;

-- 8.2 RLS activo y SIN politicas: nadie llega por acceso directo a la tabla.
--     Las funciones SECURITY DEFINER son propiedad del owner y la saltan.
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- 8.3 Revocacion de privilegios sobre las tablas de esta aplicacion.
--     Se nombran una a una a proposito: un REVOKE ... ON ALL TABLES afectaria
--     tambien a cualquier otra tabla que el proyecto Supabase tenga en public.
REVOKE ALL ON TABLE employees       FROM anon, authenticated;
REVOKE ALL ON TABLE time_entries    FROM anon, authenticated;
REVOKE ALL ON TABLE locations       FROM anon, authenticated;
REVOKE ALL ON TABLE breaks          FROM anon, authenticated;
REVOKE ALL ON TABLE system_settings FROM anon, authenticated;
REVOKE ALL ON TABLE sessions        FROM anon, authenticated;
REVOKE ALL ON TABLE login_attempts  FROM anon, authenticated;

-- 8.4 PostgreSQL concede EXECUTE a PUBLIC en cada funcion nueva. Se lo quitamos
--     a las funciones de este esquema (solo a esas) y despues concedemos
--     explicitamente las 28 que forman la API real.
DO $revoke$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (left(p.proname, 1) = '_' OR left(p.proname, 6) = 'admin_'
               OR p.proname IN ('login_with_pin', 'register_employee', 'register_admin',
                                'logout', 'get_me', 'get_my_status', 'get_public_settings',
                                'clock_in', 'clock_out', 'start_break', 'end_break',
                                'record_location', 'trigger_hash_pin'))
    LOOP
        EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon, authenticated';
    END LOOP;
END
$revoke$;

-- API publica (sin token)
GRANT EXECUTE ON FUNCTION get_public_settings()                                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login_with_pin(TEXT)                                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_employee(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Sesion
GRANT EXECUTE ON FUNCTION logout(TEXT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_me(TEXT)  TO anon, authenticated;

-- Empleado
GRANT EXECUTE ON FUNCTION get_my_status(TEXT)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION clock_in(TEXT, JSONB)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION clock_out(TEXT, JSONB, TEXT)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION start_break(TEXT, TEXT)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION end_break(TEXT)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_location(TEXT, DOUBLE PRECISION, DOUBLE PRECISION,
                                          DOUBLE PRECISION, DOUBLE PRECISION,
                                          DOUBLE PRECISION, INTEGER) TO anon, authenticated;

-- Administracion
GRANT EXECUTE ON FUNCTION admin_list_users(TEXT)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_admins(TEXT)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_assignable_admins(TEXT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_history(TEXT)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_time_entry(TEXT, UUID)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_active_user_ids(TEXT)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_live_locations(TEXT)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_employee(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_verify_employee(TEXT, UUID)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_assign_employee(TEXT, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_role(TEXT, UUID, TEXT)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_employee(TEXT, UUID)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_registration_enabled(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_impersonate(TEXT, UUID)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_regenerate_invite_code(TEXT, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. MIGRACION DE DATOS EXISTENTES
-- ---------------------------------------------------------------------------

-- 9.1 Marcar al Administrador Maestro. Antes se reconocia comparando el texto
--     'CORP-18EC' en tres sitios distintos del frontend; ahora es una columna.
UPDATE employees
   SET is_master = true, role = 'admin', verified = true
 WHERE upper(coalesce(invite_code, '')) = 'CORP-18EC';

-- Si no habia ninguno, asciende al administrador mas antiguo.
DO $master$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM employees WHERE is_master) THEN
        UPDATE employees SET is_master = true, verified = true
         WHERE id = (SELECT id FROM employees WHERE role = 'admin'
                      ORDER BY created_at ASC LIMIT 1);
    END IF;
END
$master$;

-- 9.2 Coherencia de roles: el PIN con prefijo '@' era un "admin implicito".
--     Se consolida en la columna role, que pasa a ser la unica fuente de verdad.
UPDATE employees
   SET role = 'admin'
 WHERE role <> 'admin' AND pin_text LIKE '@%';

-- 9.3 Todo administrador necesita un codigo de organizacion unico.
DO $codes$
DECLARE
    r    RECORD;
    v_c  TEXT;
BEGIN
    FOR r IN SELECT id FROM employees
              WHERE role = 'admin'
                AND (invite_code IS NULL OR position('?' in invite_code) > 0)
    LOOP
        LOOP
            v_c := 'CORP-' || upper(substring(md5(random()::text), 1, 4));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM employees WHERE invite_code = v_c);
        END LOOP;
        UPDATE employees SET invite_code = v_c WHERE id = r.id;
    END LOOP;
END
$codes$;

-- 9.4 Empleados huerfanos: se dejan como estaban salvo que ya estuvieran
--     validados, en cuyo caso se adjuntan al administrador mas antiguo (que es
--     lo que hacia el RPC de registro anterior). Los no validados se quedan sin
--     asignar para que el maestro los coloque desde el panel.
UPDATE employees
   SET admin_id = (SELECT id FROM employees WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)
 WHERE role = 'employee' AND admin_id IS NULL AND verified = true;

-- 9.5 Los PIN guardados en claro tenian que estar hasheados. Si algun registro
--     antiguo quedo sin hash valido, se regenera desde pin_text.
UPDATE employees
   SET pin_hash = crypt(pin_text, gen_salt('bf'))
 WHERE pin_text IS NOT NULL
   AND (pin_hash IS NULL OR pin_hash = '' OR pin_hash = 'x' OR pin_hash NOT LIKE '$2%');

-- 9.6 Cualquier sesion emitida antes de este despliegue queda invalidada.
DELETE FROM sessions;

-- ---------------------------------------------------------------------------
-- 10. COMPROBACION FINAL
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    v_masters INT;
    v_leaks   INT;
BEGIN
    SELECT count(*) INTO v_masters FROM employees WHERE is_master;

    SELECT count(*) INTO v_leaks
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name IN ('employees', 'time_entries', 'locations', 'breaks',
                          'system_settings', 'sessions', 'login_attempts')
       AND grantee IN ('anon', 'authenticated');

    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE 'GEOHACKER: esquema aplicado.';
    RAISE NOTICE 'Administradores maestros: %', v_masters;
    RAISE NOTICE 'Permisos de tabla para anon/authenticated: % (debe ser 0)', v_leaks;
    RAISE NOTICE '--------------------------------------------';

    IF v_masters <> 1 THEN
        RAISE WARNING 'Se esperaba exactamente 1 Administrador Maestro, hay %.', v_masters;
    END IF;
    IF v_leaks > 0 THEN
        RAISE WARNING 'Todavia hay permisos directos de tabla para anon/authenticated.';
    END IF;
END
$verify$;

NOTIFY pgrst, 'reload schema';



-- ==========================================================================
-- INICIO DE db/demo_seed.sql
-- ==========================================================================

-- ============================================================================
-- GEOHACKER — DATOS DE DEMOSTRACIÓN
-- ============================================================================
-- Crea un mundo de demo completo: un Administrador Maestro, dos empresas con
-- sus administradores y empleados, una empresa pendiente de validar, historial
-- de fichajes de los últimos días, pausas, rutas GPS y dos turnos abiertos
-- ahora mismo para que el mapa en vivo tenga contenido.
--
-- REQUISITO: ejecutar antes db/schema.sql.
--
-- Es idempotente: vuelve a generar el mundo de demo desde cero en cada
-- ejecución. Todas las cuentas usan el dominio @demo.geohacker.app, que es lo
-- que permite borrarlas sin tocar datos reales (ver db/demo_reset.sql).
--
-- ⚠️  NO lo ejecutes en la base de datos de producción.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LIMPIEZA DE UNA EJECUCIÓN ANTERIOR
-- ---------------------------------------------------------------------------
-- El borrado en cascada se lleva por delante fichajes, pausas y ubicaciones.
DELETE FROM employees WHERE employee_email LIKE '%@demo.geohacker.app';

-- ---------------------------------------------------------------------------
-- 2. CUENTAS
-- ---------------------------------------------------------------------------
-- pin_hash se rellena con un valor de relleno a propósito: el trigger
-- trg_hash_pin lo sustituye por el bcrypt real de pin_text.

-- 2.1 Administrador Maestro
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, is_master,
     employee_email, invite_code, company_name, fiscal_id)
VALUES
    ('JOSE', 'MAESTRO', '99999999', 'x', 'admin', true, true,
     'maestro@demo.geohacker.app', 'CORP-DEMO', 'GEOHACKER Central', 'B00000000');

-- 2.2 Administradores de empresa (validados)
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, is_master,
     employee_email, invite_code, company_name, fiscal_id)
VALUES
    ('LAURA', 'VEGA', '@10001', 'x', 'admin', true, false,
     'laura.vega@demo.geohacker.app', 'CORP-NRT1', 'Logística Norte S.L.', 'B11111111'),
    ('MARCOS', 'RUIZ', '@10002', 'x', 'admin', true, false,
     'marcos.ruiz@demo.geohacker.app', 'CORP-SUR2', 'Servicios Sur S.A.', 'A22222222');

-- 2.3 Administrador pendiente de validación (para probar ese flujo)
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, is_master,
     employee_email, invite_code, company_name, fiscal_id)
VALUES
    ('ELENA', 'SOTO', '@10003', 'x', 'admin', false, false,
     'elena.soto@demo.geohacker.app', 'CORP-EST3', 'Transportes Este S.L.', 'B33333333');

-- 2.4 Empleados de Logística Norte
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, employee_email, admin_id)
VALUES
    ('ANA',   'TORRES', '1001', 'x', 'employee', true, 'ana.torres@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10001')),
    ('DAVID', 'MORA',   '1002', 'x', 'employee', true, 'david.mora@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10001')),
    ('SOFIA', 'LEON',   '1003', 'x', 'employee', true, 'sofia.leon@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10001'));

-- 2.5 Empleados de Servicios Sur
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, employee_email, admin_id)
VALUES
    ('HUGO',   'PRIETO', '2001', 'x', 'employee', true, 'hugo.prieto@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10002')),
    ('CARMEN', 'GIL',    '2002', 'x', 'employee', true, 'carmen.gil@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10002'));

-- 2.6 Alta sin asignar (para probar "Validar y Asignar Usuario" del Maestro)
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, employee_email, admin_id)
VALUES
    ('IVAN', 'RAMOS', '3001', 'x', 'employee', false, 'ivan.ramos@demo.geohacker.app', NULL);

-- ---------------------------------------------------------------------------
-- 3. HISTORIAL DE FICHAJES, PAUSAS Y RUTAS GPS
-- ---------------------------------------------------------------------------
DO $demo$
DECLARE
    v_emp        RECORD;
    v_dia        INTEGER;
    v_entrada    TIMESTAMPTZ;
    v_salida     TIMESTAMPTZ;
    v_shift      UUID;
    v_lat        DOUBLE PRECISION;
    v_lng        DOUBLE PRECISION;
    v_lat_fin    DOUBLE PRECISION;
    v_lng_fin    DOUBLE PRECISION;
    v_punto      INTEGER;
    v_puntos     INTEGER := 14;
    v_f          DOUBLE PRECISION;
    v_pausa_ini  TIMESTAMPTZ;
    v_motivos    TEXT[] := ARRAY['Comida', 'Descanso', 'Café', 'Gestión personal'];
BEGIN
    FOR v_emp IN
        SELECT e.id,
               e.pin_text,
               -- Cada empresa opera en una zona distinta para que el mapa se vea.
               CASE WHEN e.pin_text LIKE '1%' THEN 40.4168 ELSE 37.3891 END AS lat_base,
               CASE WHEN e.pin_text LIKE '1%' THEN -3.7038 ELSE -5.9845 END AS lng_base
        FROM employees e
        WHERE e.employee_email LIKE '%@demo.geohacker.app'
          AND e.role = 'employee'
          AND e.verified = true
        ORDER BY e.pin_text
    LOOP
        -- Seis jornadas cerradas, de anteayer hacia atrás.
        FOR v_dia IN 1..6 LOOP
            v_entrada := date_trunc('day', now()) - (v_dia || ' days')::INTERVAL
                         + INTERVAL '8 hours'
                         + (floor(random() * 25)::INTEGER || ' minutes')::INTERVAL;
            v_salida  := v_entrada + INTERVAL '8 hours'
                         + (floor(random() * 50)::INTEGER || ' minutes')::INTERVAL;

            -- Punto de salida y destino de la jornada (recorrido corto por ciudad).
            v_lat     := v_emp.lat_base + (random() - 0.5) * 0.04;
            v_lng     := v_emp.lng_base + (random() - 0.5) * 0.04;
            v_lat_fin := v_lat + (random() - 0.5) * 0.05;
            v_lng_fin := v_lng + (random() - 0.5) * 0.05;

            INSERT INTO time_entries
                (employee_id, start_time, end_time, status, start_location, end_location, notes)
            VALUES (
                v_emp.id, v_entrada, v_salida, 'completed',
                jsonb_build_object('lat', v_lat,     'lng', v_lng,     'accuracy', 8),
                jsonb_build_object('lat', v_lat_fin, 'lng', v_lng_fin, 'accuracy', 10),
                CASE WHEN random() < 0.3 THEN 'Jornada completada sin incidencias' ELSE NULL END
            )
            RETURNING id INTO v_shift;

            -- Ruta GPS: interpolación entre origen y destino con algo de ruido.
            FOR v_punto IN 0..v_puntos LOOP
                v_f := v_punto::DOUBLE PRECISION / v_puntos;
                INSERT INTO locations
                    (employee_id, time_entry_id, latitude, longitude,
                     accuracy, heading, speed, battery_level, timestamp)
                VALUES (
                    v_emp.id, v_shift,
                    v_lat + (v_lat_fin - v_lat) * v_f + (random() - 0.5) * 0.0015,
                    v_lng + (v_lng_fin - v_lng) * v_f + (random() - 0.5) * 0.0015,
                    5 + random() * 12,
                    random() * 360,
                    random() * 11,
                    greatest(15, 100 - round(v_f * 55)::INTEGER),
                    v_entrada + ((v_salida - v_entrada) * v_f)
                );
            END LOOP;

            -- Pausa a media jornada en la mayoría de los días.
            IF random() < 0.75 THEN
                v_pausa_ini := v_entrada + INTERVAL '4 hours'
                               + (floor(random() * 40)::INTEGER || ' minutes')::INTERVAL;
                INSERT INTO breaks (time_entry_id, start_time, end_time, reason)
                VALUES (
                    v_shift, v_pausa_ini,
                    v_pausa_ini + ((20 + floor(random() * 40))::INTEGER || ' minutes')::INTERVAL,
                    v_motivos[1 + floor(random() * array_length(v_motivos, 1))::INTEGER]
                );
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Historial de demo generado.';
END
$demo$;

-- ---------------------------------------------------------------------------
-- 4. TURNOS ABIERTOS AHORA MISMO (para el mapa en vivo)
-- ---------------------------------------------------------------------------
DO $vivo$
DECLARE
    v_emp     RECORD;
    v_shift   UUID;
    v_inicio  TIMESTAMPTZ;
    v_lat     DOUBLE PRECISION;
    v_lng     DOUBLE PRECISION;
    v_punto   INTEGER;
    v_puntos  INTEGER := 10;
    v_f       DOUBLE PRECISION;
BEGIN
    FOR v_emp IN
        SELECT e.id,
               e.pin_text,
               CASE WHEN e.pin_text = '1001' THEN 40.4168 ELSE 37.3891 END AS lat_base,
               CASE WHEN e.pin_text = '1001' THEN -3.7038 ELSE -5.9845 END AS lng_base
        FROM employees e
        -- ANA TORRES (Norte) y HUGO PRIETO (Sur): uno por empresa, para que
        -- cada administrador vea a alguien trabajando en su propio mapa.
        WHERE e.pin_text IN ('1001', '2001')
          AND e.employee_email LIKE '%@demo.geohacker.app'
    LOOP
        v_inicio := now() - INTERVAL '3 hours';
        v_lat := v_emp.lat_base + (random() - 0.5) * 0.02;
        v_lng := v_emp.lng_base + (random() - 0.5) * 0.02;

        INSERT INTO time_entries (employee_id, start_time, end_time, status, start_location)
        VALUES (
            v_emp.id, v_inicio, NULL, 'active',
            jsonb_build_object('lat', v_lat, 'lng', v_lng, 'accuracy', 7)
        )
        RETURNING id INTO v_shift;

        -- Rastro de las últimas 3 horas; el último punto es de hace un minuto,
        -- así el panel lo muestra como señal reciente.
        FOR v_punto IN 0..v_puntos LOOP
            v_f := v_punto::DOUBLE PRECISION / v_puntos;
            INSERT INTO locations
                (employee_id, time_entry_id, latitude, longitude,
                 accuracy, heading, speed, battery_level, timestamp)
            VALUES (
                v_emp.id, v_shift,
                v_lat + v_f * 0.012 + (random() - 0.5) * 0.001,
                v_lng + v_f * 0.010 + (random() - 0.5) * 0.001,
                4 + random() * 9,
                random() * 360,
                random() * 9,
                greatest(20, 95 - round(v_f * 40)::INTEGER),
                v_inicio + ((now() - INTERVAL '1 minute' - v_inicio) * v_f)
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Turnos activos de demo creados.';
END
$vivo$;

-- ---------------------------------------------------------------------------
-- 5. AJUSTES
-- ---------------------------------------------------------------------------
-- El registro abierto permite probar el alta pública desde la demo.
INSERT INTO system_settings (key, value, updated_at)
VALUES ('registrations_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();

-- ---------------------------------------------------------------------------
-- 6. RESUMEN
-- ---------------------------------------------------------------------------
DO $resumen$
DECLARE
    v_cuentas  INTEGER;
    v_fichajes INTEGER;
    v_puntos   INTEGER;
    v_activos  INTEGER;
    v_masters  INTEGER;
BEGIN
    SELECT count(*) INTO v_cuentas FROM employees
     WHERE employee_email LIKE '%@demo.geohacker.app';

    SELECT count(*) INTO v_fichajes FROM time_entries te
      JOIN employees e ON e.id = te.employee_id
     WHERE e.employee_email LIKE '%@demo.geohacker.app';

    SELECT count(*) INTO v_puntos FROM locations l
      JOIN employees e ON e.id = l.employee_id
     WHERE e.employee_email LIKE '%@demo.geohacker.app';

    SELECT count(*) INTO v_activos FROM time_entries te
      JOIN employees e ON e.id = te.employee_id
     WHERE e.employee_email LIKE '%@demo.geohacker.app' AND te.end_time IS NULL;

    SELECT count(*) INTO v_masters FROM employees WHERE is_master;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'DEMO GEOHACKER LISTA';
    RAISE NOTICE '  Cuentas creadas .......... %', v_cuentas;
    RAISE NOTICE '  Fichajes ................. %', v_fichajes;
    RAISE NOTICE '  Puntos GPS ............... %', v_puntos;
    RAISE NOTICE '  Turnos abiertos ahora .... %', v_activos;
    RAISE NOTICE '  Administradores maestros . %', v_masters;
    RAISE NOTICE '';
    RAISE NOTICE '  Maestro   99999999   JOSE MAESTRO';
    RAISE NOTICE '  Admin     @10001     LAURA VEGA    (Logistica Norte)';
    RAISE NOTICE '  Admin     @10002     MARCOS RUIZ   (Servicios Sur)';
    RAISE NOTICE '  Empleado  1001       ANA TORRES    (fichada ahora)';
    RAISE NOTICE '  Empleado  2001       HUGO PRIETO   (fichado ahora)';
    RAISE NOTICE '------------------------------------------------';

    IF v_masters <> 1 THEN
        RAISE WARNING 'Hay % administradores maestros. En una demo limpia deberia haber 1.', v_masters;
    END IF;
END
$resumen$;
