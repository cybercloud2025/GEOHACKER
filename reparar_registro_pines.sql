-- ========================================================
-- REPARACIÓN DE REGISTRO DE PINES Y FUNCIÓN RPC
-- Garantiza que el 'pin_text' se guarde visiblemente siempre.
-- ========================================================

-- 1. Asegurar que la columna existe
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_text TEXT;

-- 2. Redefinir la función de registro para FORZAR el guardado del pin visible
DROP FUNCTION IF EXISTS register_employee_with_code(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION register_employee_with_code(
    p_first_name TEXT,
    p_last_name TEXT,
    p_pin TEXT,
    p_email TEXT,
    p_avatar_url TEXT,
    p_invite_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_new_id UUID;
    v_new_invite_code TEXT := NULL;
BEGIN
    -- Buscar Admin por código
    SELECT id INTO v_admin_id FROM employees WHERE invite_code = p_invite_code AND role = 'admin';
    
    IF v_admin_id IS NOT NULL THEN
        -- Registrar como Empleado
        INSERT INTO employees (
            first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, admin_id
        ) VALUES (
            p_first_name, 
            p_last_name, 
            crypt(p_pin, gen_salt('bf')), 
            p_pin, -- AQUÍ SE GUARDA EL PIN VISIBLE
            'employee', 
            p_email, 
            p_avatar_url,
            v_admin_id
        ) RETURNING id INTO v_new_id;
        
        RETURN jsonb_build_object('id', v_new_id, 'role', 'employee', 'admin_id', v_admin_id);
    
    ELSE
        -- Registrar como Nuevo Admin (si el código es 'NEW' o es inválido/nuevo)
        IF p_invite_code = 'NEW' OR p_invite_code IS NULL THEN
             v_new_invite_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
             
             INSERT INTO employees (
                first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, invite_code
             ) VALUES (
                p_first_name, 
                p_last_name, 
                crypt(p_pin, gen_salt('bf')), 
                p_pin, -- AQUÍ SE GUARDA EL PIN VISIBLE
                'admin', 
                p_email, 
                p_avatar_url,
                v_new_invite_code
             ) RETURNING id INTO v_new_id;
             
             RETURN jsonb_build_object('id', v_new_id, 'role', 'admin', 'invite_code', v_new_invite_code);
        ELSE
            RAISE EXCEPTION 'Código de organización inválido.';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger de Respaldo: Si pin_text cambia, actualizar hash (seguridad y consistencia)
CREATE OR REPLACE FUNCTION public.hash_employee_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin_text IS NOT NULL THEN
    NEW.pin_hash := crypt(NEW.pin_text, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_hash_pin ON public.employees;
CREATE TRIGGER tr_hash_pin
BEFORE INSERT OR UPDATE OF pin_text ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.hash_employee_pin();

-- 4. Mensaje para confirmar ejecución
SELECT 'Funciones de registro reparadas. Los próximos usuarios SI tendrán PIN visible.' as status;
