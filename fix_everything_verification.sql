-- ========================================================
-- REPARACIÓN DEFINITIVA DE ACCESO Y ROLES (v4)
-- Ejecuta esto para corregir la asignación de roles.
-- ========================================================

-- 1. Función de Login Robustecida
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB AS $$
DECLARE
  v_employee RECORD;
BEGIN
  FOR v_employee IN 
    SELECT * FROM employees 
    WHERE (is_active IS NOT FALSE)
  LOOP
    IF v_employee.pin_hash = crypt(p_pin, v_employee.pin_hash) THEN
      RETURN jsonb_build_object(
        'id', v_employee.id,
        'first_name', v_employee.first_name,
        'last_name', v_employee.last_name,
        'role', v_employee.role, -- 'employee' o 'admin'
        'verified', COALESCE(v_employee.verified, false),
        'admin_id', v_employee.admin_id,
        'invite_code', v_employee.invite_code,
        'employee_email', v_employee.employee_email
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función de Registro Corregida (Lógica "Sin Código")
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
    v_admin_email TEXT;
    v_new_id UUID;
    v_new_invite_code TEXT := NULL;
BEGIN
    -- CASO 1: Código Específico proporcionado (Registro normal vinculado)
    IF p_invite_code IS NOT NULL AND p_invite_code <> 'NEW' THEN
        SELECT id, employee_email INTO v_admin_id, v_admin_email 
        FROM employees 
        WHERE invite_code = p_invite_code AND role = 'admin';
        
        IF v_admin_id IS NULL THEN
             RAISE EXCEPTION 'Código de organización inválido.';
        END IF;

    -- CASO 2: Registro Público (Sin código) -> Asignar al PRIMER ADMIN (Master Admin)
    ELSIF p_invite_code IS NULL THEN
        SELECT id, employee_email INTO v_admin_id, v_admin_email 
        FROM employees 
        WHERE role = 'admin' 
        ORDER BY created_at ASC 
        LIMIT 1;
        
        IF v_admin_id IS NULL THEN
             RAISE EXCEPTION 'No se encontró un administrador para vincular la cuenta.';
        END IF;
    END IF;

    -- --- LÓGICA DE INSERCIÓN ---
    
    -- Si tenemos un ADMIN_ID, es un EMPLEADO (ya sea por código o registro público)
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO employees (
            first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, admin_id, verified, is_active
        ) VALUES (
            p_first_name, p_last_name, 
            crypt(p_pin, gen_salt('bf')), p_pin, 
            'employee', 
            p_email, p_avatar_url, v_admin_id, 
            false, -- Temporal: Requiere validación por el admin vinculado
            true
        ) RETURNING id INTO v_new_id;
        
        RETURN jsonb_build_object(
            'id', v_new_id, 'role', 'employee', 'admin_id', v_admin_id, 
            'admin_email', v_admin_email, 'verified', false
        );

    -- CASO 3: Creación Explícita de Admin (Solo si código es 'NEW')
    ELSIF p_invite_code = 'NEW' THEN
         v_new_invite_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
         
         INSERT INTO employees (
            first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, invite_code, verified, is_active
         ) VALUES (
            p_first_name, p_last_name, 
            crypt(p_pin, gen_salt('bf')), p_pin, 
            'admin', 
            p_email, p_avatar_url, v_new_invite_code, 
            true, -- Los nuevos administradores se consideran verificados al crear su organización
            true
         ) RETURNING id INTO v_new_id;
         
         RETURN jsonb_build_object(
            'id', v_new_id, 'role', 'admin', 'invite_code', v_new_invite_code, 'verified', true
         );
    ELSE
        RAISE EXCEPTION 'Error desconocido durante el registro.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Lógica de roles corregida. Registros públicos ahora son EMPLEADOS.' as status;

-- 3. Limpieza de Datos Existentes (Opcional pero Recomendado)
-- Asegura que todos los admins tengan un código CORP-XXXX real y no el placeholder ????
-- También asegura que los usuarios existentes sean marcados como verificados.

DO $$
DECLARE
    v_admin RECORD;
    v_new_code TEXT;
BEGIN
    -- 1. Actualizar admins con códigos placeholder
    FOR v_admin IN 
        SELECT id FROM employees 
        WHERE role = 'admin' AND (invite_code IS NULL OR invite_code LIKE '%?%')
    LOOP
        v_new_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
        UPDATE employees SET invite_code = v_new_code WHERE id = v_admin.id;
    END LOOP;

    -- 2. Asegurar que los usuarios que ya están en el sistema no se queden bloqueados como "temporales"
    -- Solo si quieres que los actuales sigan funcionando sin intervención.
    UPDATE employees SET verified = true WHERE verified IS NULL;
END $$;

SELECT 'Limpieza completada: Códigos generados y usuarios existentes verificados.' as cleanup_status;
