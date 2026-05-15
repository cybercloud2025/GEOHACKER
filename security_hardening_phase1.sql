-- ============================================================
-- GEOHACKER — SECURITY HARDENING PHASE 1
-- ============================================================
-- Ejecutar EN ORDEN en Supabase SQL Editor.
-- Cada bloque es idempotente (se puede correr varias veces).
-- ============================================================

-- ============================================================
-- BLOQUE 1 — TABLA DE INTENTOS DE LOGIN (rate limit)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id          BIGSERIAL PRIMARY KEY,
  ip_address  TEXT,
  pin_hint    TEXT,                            -- primeros 2 chars del PIN para diagnóstico (no PIN completo)
  success     BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
  ON login_attempts(ip_address, attempted_at DESC);

-- Limpieza automática: borra registros > 30 días (manual o cron)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts() RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- BLOQUE 2 — RPC LOGIN ENDURECIDO con rate limit
-- ============================================================
-- Reemplaza login_with_pin con versión que:
--   1. Verifica intentos fallidos por IP (max 5 en 15 min → bloquea)
--   2. Registra cada intento
--   3. Mantiene compatibilidad con frontend actual
-- ============================================================
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT, p_ip TEXT DEFAULT NULL, p_ua TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_result    JSONB;
  v_fail_count INT;
  v_pin_hint  TEXT;
BEGIN
  v_pin_hint := COALESCE(LEFT(p_pin, 2), '');

  -- Rate limit: max 5 fallos en 15 minutos por IP
  IF p_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_fail_count
    FROM login_attempts
    WHERE ip_address = p_ip
      AND success = false
      AND attempted_at > NOW() - INTERVAL '15 minutes';

    IF v_fail_count >= 5 THEN
      INSERT INTO login_attempts(ip_address, pin_hint, success, user_agent)
      VALUES (p_ip, v_pin_hint, false, p_ua);
      RETURN jsonb_build_object('error', 'rate_limited',
        'message', 'Demasiados intentos fallidos. Espera 15 minutos.');
    END IF;
  END IF;

  -- Buscar usuario por PIN
  SELECT jsonb_build_object(
    'id', id,
    'first_name', first_name,
    'last_name', last_name,
    'role', role,
    'invite_code', invite_code,
    'verified', verified,
    'admin_id', admin_id,
    'employee_email', employee_email,
    'avatar_url', avatar_url
  ) INTO v_result
  FROM employees
  WHERE is_active = true
    AND pin_hash = crypt(p_pin, pin_hash)
  LIMIT 1;

  -- Registrar resultado
  INSERT INTO login_attempts(ip_address, pin_hint, success, user_agent)
  VALUES (p_ip, v_pin_hint, v_result IS NOT NULL, p_ua);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- BLOQUE 3 — AUDIT LOG (registro de acciones sensibles)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,              -- 'login', 'role_change', 'delete_user', 'impersonate', 'admin_create', etc.
  actor_id    UUID,                       -- quien hizo la acción
  target_id   UUID,                       -- a quién/qué afectó
  payload     JSONB,                      -- datos adicionales
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_time
  ON audit_events(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_target_time
  ON audit_events(target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_type_time
  ON audit_events(event_type, created_at DESC);

-- RPC para que el frontend registre eventos
CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type TEXT,
  p_actor_id   UUID DEFAULT NULL,
  p_target_id  UUID DEFAULT NULL,
  p_payload    JSONB DEFAULT NULL,
  p_ip         TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO audit_events(event_type, actor_id, target_id, payload, ip_address)
  VALUES (p_event_type, p_actor_id, p_target_id, p_payload, p_ip)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- BLOQUE 4 — GENERADOR INVITE_CODE LARGO Y ALEATORIO
-- ============================================================
-- Reemplaza CORP-XXXX (predecible) con CORP-AAAAAAAAAAAAAAAA (16 chars)
CREATE OR REPLACE FUNCTION generate_secure_invite_code() RETURNS TEXT AS $$
DECLARE
  chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin 0,O,I,1 para legibilidad
  result TEXT := 'CORP-';
  i      INT;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, (floor(random() * length(chars))::INT + 1), 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- NOTA: NO regenerar invite_code de admins existentes automáticamente
-- (rompería el vínculo con empleados ya registrados).
-- Para rotar manualmente un admin específico, ver migrate_invite_code() abajo.

CREATE OR REPLACE FUNCTION rotate_invite_code(p_admin_id UUID) RETURNS TEXT AS $$
DECLARE
  v_new_code TEXT;
BEGIN
  v_new_code := generate_secure_invite_code();
  -- Asegurar unicidad
  WHILE EXISTS(SELECT 1 FROM employees WHERE invite_code = v_new_code) LOOP
    v_new_code := generate_secure_invite_code();
  END LOOP;
  UPDATE employees SET invite_code = v_new_code WHERE id = p_admin_id;
  PERFORM log_audit_event('invite_code_rotated', p_admin_id, p_admin_id,
    jsonb_build_object('new_code', v_new_code));
  RETURN v_new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- BLOQUE 5 — REVOCAR PERMISOS PELIGROSOS A ANON
-- ============================================================
-- Aunque RLS no se cierra todavía (Fase 2), quitamos acceso directo a
-- tablas sensibles. La app pasa solo por RPCs SECURITY DEFINER.
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON login_attempts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_events FROM anon, authenticated;
GRANT SELECT ON audit_events TO anon, authenticated;  -- solo Master debería ver via RPC, pero no rompemos nada


-- ============================================================
-- BLOQUE 6 — INDEX EN COLUMNAS SENSIBLES (rendimiento + protección)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_invite_code ON employees(invite_code);
CREATE INDEX IF NOT EXISTS idx_employees_pin_active ON employees(is_active) WHERE pin_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_admin_id ON employees(admin_id);


-- ============================================================
-- BLOQUE 7 — VERIFICACIÓN FINAL
-- ============================================================
SELECT 'login_attempts' as obj, COUNT(*) FROM login_attempts
UNION ALL
SELECT 'audit_events', COUNT(*) FROM audit_events
UNION ALL
SELECT 'login_with_pin exists',
  CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname='login_with_pin') THEN 1 ELSE 0 END
UNION ALL
SELECT 'generate_secure_invite_code exists',
  CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname='generate_secure_invite_code') THEN 1 ELSE 0 END;

-- Esperado:
--   login_attempts | 0
--   audit_events   | 0
--   login_with_pin exists | 1
--   generate_secure_invite_code exists | 1
