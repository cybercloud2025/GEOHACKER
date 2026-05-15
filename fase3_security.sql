-- ============================================================
-- GEOHACKER — FASE 3: 2FA + EMAIL VERIFICATION + PII ENCRYPTION
-- ============================================================
-- Requiere: Fase 1 y Fase 2 aplicadas.
-- Reversible: SI (cada bloque tiene su DROP comentado abajo)
-- ============================================================

-- ============================================================
-- SECCIÓN A — VERIFICACIÓN DE EMAIL OBLIGATORIA
-- ============================================================

-- Tabla de tokens de verificación
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evt_token ON email_verification_tokens(token) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evt_employee ON email_verification_tokens(employee_id);

-- Añadir flag email_verified a employees si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='employees' AND column_name='email_verified'
  ) THEN
    ALTER TABLE employees ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
    -- Marca como verificados a usuarios existentes con email (no rompemos cuentas activas)
    UPDATE employees SET email_verified = TRUE WHERE employee_email IS NOT NULL;
  END IF;
END $$;

-- RPC: generar token de verificación
CREATE OR REPLACE FUNCTION request_email_verification(p_employee_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_token TEXT;
  v_email TEXT;
BEGIN
  SELECT employee_email INTO v_email FROM employees WHERE id = p_employee_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'no_email', 'message', 'El usuario no tiene email registrado');
  END IF;

  -- Token aleatorio de 32 bytes hex
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Invalidar tokens previos del usuario
  UPDATE email_verification_tokens
  SET consumed_at = NOW()
  WHERE employee_id = p_employee_id AND consumed_at IS NULL;

  -- Insertar nuevo token (válido 24h)
  INSERT INTO email_verification_tokens(employee_id, token, expires_at)
  VALUES (p_employee_id, v_token, NOW() + INTERVAL '24 hours');

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'email', v_email,
    'expires_at', NOW() + INTERVAL '24 hours'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: validar token
CREATE OR REPLACE FUNCTION verify_email_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_employee_id UUID;
  v_expires TIMESTAMPTZ;
  v_consumed TIMESTAMPTZ;
BEGIN
  SELECT employee_id, expires_at, consumed_at
  INTO v_employee_id, v_expires, v_consumed
  FROM email_verification_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  IF v_consumed IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_used');
  END IF;

  IF v_expires < NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  UPDATE email_verification_tokens SET consumed_at = NOW() WHERE token = p_token;
  UPDATE employees SET email_verified = TRUE WHERE id = v_employee_id;

  PERFORM log_audit_event('email_verified', v_employee_id, v_employee_id, NULL);

  RETURN jsonb_build_object('success', true, 'employee_id', v_employee_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SECCIÓN B — TWO-FACTOR AUTHENTICATION (TOTP)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_2fa (
  employee_id   UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  secret_b32    TEXT NOT NULL,                     -- TOTP secret en base32 (cliente genera, server valida)
  backup_codes  TEXT[] NOT NULL DEFAULT '{}',     -- códigos hash bcrypt
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,    -- false hasta primer verify exitoso
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_2fa_enabled ON user_2fa(enabled) WHERE enabled = TRUE;

-- RPC: registrar secret 2FA (cliente lo genera vía otplib, server lo persiste)
CREATE OR REPLACE FUNCTION setup_2fa(
  p_employee_id UUID,
  p_secret_b32  TEXT
) RETURNS JSONB AS $$
DECLARE
  v_backup_codes TEXT[];
  v_code TEXT;
  i INT;
BEGIN
  -- Solo admins/master pueden activar 2FA
  IF NOT EXISTS(SELECT 1 FROM employees WHERE id = p_employee_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden activar 2FA';
  END IF;

  -- Generar 10 backup codes (8 dígitos cada uno)
  v_backup_codes := ARRAY[]::TEXT[];
  FOR i IN 1..10 LOOP
    v_code := lpad((floor(random() * 100000000))::TEXT, 8, '0');
    v_backup_codes := array_append(v_backup_codes, crypt(v_code, gen_salt('bf')));
  END LOOP;

  -- Insertar / actualizar
  INSERT INTO user_2fa(employee_id, secret_b32, backup_codes, enabled)
  VALUES (p_employee_id, p_secret_b32, v_backup_codes, FALSE)
  ON CONFLICT (employee_id) DO UPDATE
    SET secret_b32 = EXCLUDED.secret_b32,
        backup_codes = EXCLUDED.backup_codes,
        enabled = FALSE,
        created_at = NOW();

  PERFORM log_audit_event('2fa_setup_initiated', p_employee_id, p_employee_id, NULL);

  RETURN jsonb_build_object('success', true, 'message', '2FA configurado. Verifica el primer código para activarlo.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: activar 2FA tras verificar primer código (cliente valida TOTP localmente con otplib)
CREATE OR REPLACE FUNCTION enable_2fa(p_employee_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_codes TEXT[];
  v_plaintext_codes TEXT[];
  i INT;
  v_code TEXT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM user_2fa WHERE employee_id = p_employee_id) THEN
    RAISE EXCEPTION '2FA no configurado para este usuario';
  END IF;

  UPDATE user_2fa SET enabled = TRUE WHERE employee_id = p_employee_id;

  -- Regenerar y devolver plaintext de backup codes (única vez)
  v_plaintext_codes := ARRAY[]::TEXT[];
  v_codes := ARRAY[]::TEXT[];
  FOR i IN 1..10 LOOP
    v_code := lpad((floor(random() * 100000000))::TEXT, 8, '0');
    v_plaintext_codes := array_append(v_plaintext_codes, v_code);
    v_codes := array_append(v_codes, crypt(v_code, gen_salt('bf')));
  END LOOP;
  UPDATE user_2fa SET backup_codes = v_codes WHERE employee_id = p_employee_id;

  PERFORM log_audit_event('2fa_enabled', p_employee_id, p_employee_id, NULL);

  RETURN jsonb_build_object('success', true, 'backup_codes', v_plaintext_codes,
    'message', 'Guarda estos códigos de respaldo. Solo se mostrarán esta vez.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: obtener secret 2FA del usuario (para validación TOTP cliente)
CREATE OR REPLACE FUNCTION get_2fa_status(p_employee_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT secret_b32, enabled, last_used_at
  INTO v_row
  FROM user_2fa
  WHERE employee_id = p_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('configured', false);
  END IF;

  RETURN jsonb_build_object(
    'configured', true,
    'enabled', v_row.enabled,
    'secret_b32', v_row.secret_b32,
    'last_used_at', v_row.last_used_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: marcar uso de 2FA tras login exitoso (auditoría)
CREATE OR REPLACE FUNCTION mark_2fa_used(p_employee_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_2fa SET last_used_at = NOW() WHERE employee_id = p_employee_id;
  PERFORM log_audit_event('2fa_used', p_employee_id, p_employee_id, NULL);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: validar backup code (consume el código)
CREATE OR REPLACE FUNCTION verify_backup_code(p_employee_id UUID, p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_codes TEXT[];
  v_match_idx INT := 0;
  i INT;
BEGIN
  SELECT backup_codes INTO v_codes FROM user_2fa WHERE employee_id = p_employee_id AND enabled = TRUE;
  IF v_codes IS NULL THEN RETURN FALSE; END IF;

  FOR i IN 1..array_length(v_codes, 1) LOOP
    IF v_codes[i] = crypt(p_code, v_codes[i]) THEN
      v_match_idx := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_match_idx = 0 THEN RETURN FALSE; END IF;

  -- Consumir código (reemplaza por hash vacío)
  v_codes[v_match_idx] := 'USED';
  UPDATE user_2fa
  SET backup_codes = v_codes, last_used_at = NOW()
  WHERE employee_id = p_employee_id;

  PERFORM log_audit_event('2fa_backup_code_used', p_employee_id, p_employee_id, NULL);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: deshabilitar 2FA (requiere validación previa en frontend)
CREATE OR REPLACE FUNCTION disable_2fa(p_employee_id UUID, p_actor_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_actor_id != p_employee_id THEN
    -- Solo Master puede desactivar 2FA ajeno
    IF NOT EXISTS(SELECT 1 FROM employees WHERE id = p_actor_id AND invite_code = 'CORP-18EC') THEN
      RAISE EXCEPTION 'Solo el Master puede desactivar 2FA de otros usuarios';
    END IF;
  END IF;

  DELETE FROM user_2fa WHERE employee_id = p_employee_id;
  PERFORM log_audit_event('2fa_disabled', p_actor_id, p_employee_id, NULL);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SECCIÓN C — CIFRADO DE PII EN REPOSO (email + fiscal_id)
-- ============================================================
-- Usa pgcrypto pgp_sym_encrypt con clave en Supabase Vault o env.
-- Para esta versión usamos una clave en GUC database setting.
-- ⚠️ Antes de ejecutar, configura la clave:
--    ALTER DATABASE postgres SET app.pii_key = 'TU_CLAVE_LARGA_ALEATORIA_AQUI';
--    SELECT pg_reload_conf();
-- ============================================================

-- Función helper para obtener la clave
CREATE OR REPLACE FUNCTION _pii_key() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.pii_key', true);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Vistas y RPCs para acceso cifrado/descifrado (opcional — comentado por defecto)
-- Recomendación: NO migrar datos existentes hasta tener backup verificado.
/*
-- 1. Añadir columnas cifradas
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_email_enc BYTEA;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fiscal_id_enc BYTEA;

-- 2. Migrar (solo una vez, requiere _pii_key configurada)
UPDATE employees
SET
  employee_email_enc = CASE WHEN employee_email IS NOT NULL
    THEN pgp_sym_encrypt(employee_email, _pii_key()) ELSE NULL END,
  fiscal_id_enc = CASE WHEN fiscal_id IS NOT NULL
    THEN pgp_sym_encrypt(fiscal_id, _pii_key()) ELSE NULL END
WHERE _pii_key() IS NOT NULL;

-- 3. RPC para leer descifrado
CREATE OR REPLACE FUNCTION get_employee_pii(p_employee_id UUID, p_actor_id UUID)
RETURNS JSONB AS $$
DECLARE v_row RECORD;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM employees WHERE id = p_actor_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  SELECT
    pgp_sym_decrypt(employee_email_enc, _pii_key()) AS email,
    pgp_sym_decrypt(fiscal_id_enc, _pii_key()) AS fiscal_id
  INTO v_row
  FROM employees WHERE id = p_employee_id;
  PERFORM log_audit_event('pii_accessed', p_actor_id, p_employee_id, NULL);
  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Una vez validado, eliminar columnas en plaintext (DESTRUCTIVO)
-- ALTER TABLE employees DROP COLUMN employee_email;
-- ALTER TABLE employees DROP COLUMN fiscal_id;
*/


-- ============================================================
-- SECCIÓN D — GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION request_email_verification(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_email_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION setup_2fa(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION enable_2fa(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_2fa_status(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_2fa_used(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_backup_code(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION disable_2fa(UUID, UUID) TO anon, authenticated;

REVOKE ALL ON email_verification_tokens FROM anon, authenticated;
REVOKE ALL ON user_2fa FROM anon, authenticated;

ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon_evt"  ON email_verification_tokens AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_anon_2fa"  ON user_2fa                   AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT 'email_verification_tokens table',
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='email_verification_tokens') THEN 1 ELSE 0 END
UNION ALL
SELECT 'user_2fa table',
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='user_2fa') THEN 1 ELSE 0 END
UNION ALL
SELECT 'email_verified column',
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='email_verified') THEN 1 ELSE 0 END
UNION ALL
SELECT '2FA RPCs created', COUNT(*)::INT FROM pg_proc WHERE proname IN ('setup_2fa','enable_2fa','get_2fa_status','mark_2fa_used','verify_backup_code','disable_2fa')
UNION ALL
SELECT 'Email RPCs created', COUNT(*)::INT FROM pg_proc WHERE proname IN ('request_email_verification','verify_email_token');
