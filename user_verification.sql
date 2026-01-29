-- ========================================================
-- SISTEMA DE VERIFICACIÓN DE USUARIOS
-- Agrega estado 'verified' a los empleados.
-- ========================================================

-- 1. Agregar columna verified
ALTER TABLE employees ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- 2. Actualizar usuarios existentes (asumir que los que ya están son verificados)
UPDATE employees SET verified = true WHERE verified IS NULL OR verified = false;

-- 3. Actualizar función de registro para nuevos usuarios
-- Los nuevos empleados empiezan como NO VERIFICADOS (Temporal)
-- Los nuevos admins (con código NEW) los pondremos como VERIFICADOS por simplicidad, 
-- o también unverified si se desea. El usuario dice "usuarios registrados".
-- Usualmente se refiere a los empleados.

CREATE OR REPLACE FUNCTION register_employee_with_code(
    p_first_name TEXT,
    p_last_name TEXT,
    p_pin TEXT,
    p_email TEXT,
    p_avatar_url TEXT,
    p_invite_code TEXT,
    p_verified BOOLEAN DEFAULT false
)
RETURNS JSONB AS $function$
DECLARE
    v_admin_id UUID;
    v_admin_email TEXT;
    v_new_id UUID;
    v_new_invite_code TEXT := NULL;
    v_is_verified BOOLEAN := false;
BEGIN
    -- Buscar Admin por código
    SELECT id, employee_email INTO v_admin_id, v_admin_email 
    FROM employees 
    WHERE invite_code = p_invite_code AND role = 'admin';
    
    IF v_admin_id IS NOT NULL THEN
        -- Registrar como Empleado
        INSERT INTO employees (
            first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, admin_id, verified
        ) VALUES (
            p_first_name, 
            p_last_name, 
            crypt(p_pin, gen_salt('bf')), 
            p_pin, 
            'employee', 
            p_email, 
            p_avatar_url,
            v_admin_id,
            p_verified -- Usar el parámetro (por defecto false)
        ) RETURNING id INTO v_new_id;
        
        RETURN jsonb_build_object(
            'id', v_new_id, 
            'role', 'employee', 
            'admin_id', v_admin_id, 
            'admin_email', v_admin_email,
            'verified', p_verified
        );
    
    ELSE
        -- Registrar como Nuevo Admin
        IF p_invite_code = 'NEW' OR p_invite_code IS NULL THEN
             v_new_invite_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
             
             -- Notify Master Admin
             SELECT employee_email INTO v_admin_email FROM employees WHERE invite_code = 'CORP-18EC';

             INSERT INTO employees (
                first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, invite_code, verified
             ) VALUES (
                p_first_name, 
                p_last_name, 
                crypt(p_pin, gen_salt('bf')), 
                p_pin, 
                'admin', 
                p_email, 
                p_avatar_url,
                v_new_invite_code,
                p_verified -- Usar el parámetro
             ) RETURNING id INTO v_new_id;
             
             RETURN jsonb_build_object(
                'id', v_new_id, 
                'role', 'admin', 
                'invite_code', v_new_invite_code, 
                'admin_email', v_admin_email,
                'verified', p_verified
             );
        ELSE
            RAISE EXCEPTION 'Código de organización inválido.';
        END IF;
    END IF;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar login_with_pin para devolver el estado de verificación
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB AS $function$
DECLARE
  v_employee RECORD;
BEGIN
  FOR v_employee IN SELECT * FROM employees WHERE is_active = true LOOP
    IF v_employee.pin_hash = crypt(p_pin, v_employee.pin_hash) THEN
      RETURN jsonb_build_object(
        'id', v_employee.id,
        'first_name', v_employee.first_name,
        'last_name', v_employee.last_name,
        'role', v_employee.role,
        'verified', v_employee.verified,
        'admin_id', v_employee.admin_id,
        'invite_code', v_employee.invite_code
      );
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;
