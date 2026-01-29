-- ========================================================
-- FIX DEFINITIVO MASTER ACCESS (JOSE PC)
-- ========================================================

-- 1. Asegurar que JOSE PC tenga el PIN y Código correctos
-- Borramos si existe algún duplicado de código para evitar conflictos
UPDATE employees SET invite_code = NULL WHERE invite_code = 'CORP-18EC';

-- Buscamos al usuario 'JOSE PC' o al primer admin y lo configuramos
DO $$ 
DECLARE
  v_target_id UUID;
BEGIN
  -- Intentamos buscar por nombre
  SELECT id INTO v_target_id FROM employees WHERE first_name ILIKE '%JOSE%' LIMIT 1;
  
  -- Si no existe, buscamos el primer admin
  IF v_target_id IS NULL THEN
    SELECT id INTO v_target_id FROM employees WHERE role = 'admin' LIMIT 1;
  END IF;

  -- Si encontramos a alguien, lo actualizamos
  IF v_target_id IS NOT NULL THEN
    UPDATE employees 
    SET 
        first_name = 'JOSE',
        last_name = 'PC',
        pin_hash = crypt('01121973', gen_salt('bf')),
        pin_text = '01121973',
        role = 'admin',
        invite_code = 'CORP-18EC',
        is_active = true
    WHERE id = v_target_id;
  ELSE
    -- Si no hay ningún usuario, lo creamos
    INSERT INTO employees (first_name, last_name, pin_hash, pin_text, role, invite_code, is_active)
    VALUES ('JOSE', 'PC', crypt('01121973', gen_salt('bf')), '01121973', 'admin', 'CORP-18EC', true);
  END IF;
END $$;

-- 2. Asegurar que la función RPC sea ultra-robusta
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB AS $$
DECLARE
  v_employee RECORD;
BEGIN
  -- Buscamos en todos los empleados activos
  -- Comparamos usando el hash bcrypt
  FOR v_employee IN 
    SELECT * FROM employees 
    WHERE is_active = true 
  LOOP
    -- Registro de depuración (opcional en logs de Supabase)
    -- RAISE NOTICE 'Checking user %', v_employee.first_name;
    
    IF v_employee.pin_hash = crypt(p_pin, v_employee.pin_hash) THEN
      RETURN jsonb_build_object(
        'id', v_employee.id,
        'first_name', v_employee.first_name,
        'last_name', v_employee.last_name,
        'role', v_employee.role,
        'invite_code', v_employee.invite_code,
        'admin_id', v_employee.admin_id
      );
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para sincronizar pin_hash automáticamente cuando cambie pin_text
-- (Esto garantiza que las actualizaciones desde el frontend funcionen siempre)
CREATE OR REPLACE FUNCTION sync_employee_pin_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin_text IS DISTINCT FROM OLD.pin_text OR (NEW.pin_text IS NOT NULL AND NEW.pin_hash IS NULL) THEN
    NEW.pin_hash := crypt(NEW.pin_text, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pin_hash ON employees;
CREATE TRIGGER trg_sync_pin_hash
BEFORE INSERT OR UPDATE OF pin_text ON employees
FOR EACH ROW EXECUTE FUNCTION sync_employee_pin_hash();

-- 4. Verificación
SELECT id, first_name, last_name, role, invite_code 
FROM employees 
WHERE invite_code = 'CORP-18EC';
