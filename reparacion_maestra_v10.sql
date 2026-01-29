-- ========================================================
-- PROTOCOLO DE REPARACIÓN MAESTRA (V10)
-- Ejecuta esto en el SQL Editor de Supabase
-- ========================================================

-- 1. Asegurar extensión de seguridad
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Limpieza de duplicados y conflictos de código
UPDATE employees SET invite_code = NULL WHERE invite_code = 'CORP-18EC' AND first_name != 'JOSE';

-- 3. Configuración Forzada del Usuario Maestro
-- Buscamos al usuario JOSE o lo creamos si no existe
DO $$ 
DECLARE
  v_jose_id UUID;
BEGIN
  SELECT id INTO v_jose_id FROM employees WHERE first_name = 'JOSE' AND last_name = 'PC' LIMIT 1;
  
  IF v_jose_id IS NOT NULL THEN
    UPDATE employees 
    SET 
        pin_text = '01121973',
        pin_hash = crypt('01121973', gen_salt('bf')),
        role = 'admin',
        invite_code = 'CORP-18EC',
        is_active = true
    WHERE id = v_jose_id;
  ELSE
    INSERT INTO employees (first_name, last_name, pin_text, pin_hash, role, invite_code, is_active)
    VALUES ('JOSE', 'PC', '01121973', crypt('01121973', gen_salt('bf')), 'admin', 'CORP-18EC', true);
  END IF;
END $$;

-- 4. Función de Login Ultra-Simplificada (Sin bucles propensos a errores)
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
    'admin_id', admin_id
  ) INTO v_result
  FROM employees
  WHERE is_active = true 
    AND pin_hash = crypt(p_pin, pin_hash)
  LIMIT 1;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Sincronización Masiva (Por si otros PINs fallan)
UPDATE employees 
SET pin_hash = crypt(pin_text, gen_salt('bf')) 
WHERE pin_text IS NOT NULL;

-- 6. TEST DE DIAGNÓSTICO
-- Si esto devuelve 1, el PIN MAESTRO funciona en la base de datos.
SELECT count(*) as "PIN_MAESTRO_FUNCIONANDO"
FROM employees 
WHERE invite_code = 'CORP-18EC' 
  AND pin_hash = crypt('01121973', pin_hash);
