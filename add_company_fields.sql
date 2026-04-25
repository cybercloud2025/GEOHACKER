-- ==============================================================================
-- AGREGAR CAMPOS DE EMPRESA AL REGISTRO DE ADMINISTRADORES
-- ==============================================================================
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. AGREGAR COLUMNAS A LA TABLA EMPLOYEES
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fiscal_id TEXT;

-- 2. ACTUALIZAR LA FUNCIÓN RPC DE REGISTRO
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
    v_admin_id UUID := NULL;
    v_final_invite_code TEXT := p_invite_code;
    v_master_email TEXT := NULL;
BEGIN
    -- Determinar rol basado en PIN
    IF LEFT(p_pin, 1) = '@' THEN
        v_role := 'admin';
        -- Los nuevos admins necesitan código temporal hasta ser validados
        IF p_invite_code = 'NEW' OR p_invite_code IS NULL THEN
            v_final_invite_code := 'PENDING-' || SUBSTRING(md5(random()::text), 1, 4);
        END IF;
    END IF;
    
    -- Si no es admin, buscar admin por invite_code
    IF v_role = 'employee' AND p_invite_code IS NOT NULL AND p_invite_code != 'NEW' THEN
        SELECT id INTO v_admin_id 
        FROM employees 
        WHERE invite_code = p_invite_code AND role = 'admin';
        
        IF v_admin_id IS NULL THEN
            RAISE EXCEPTION 'Código de invitación inválido';
        END IF;
    END IF;
    
    -- Verificar PIN único
    IF EXISTS (SELECT 1 FROM employees WHERE pin_text = p_pin) THEN
        RAISE EXCEPTION 'Este PIN ya está en uso';
    END IF;
    
    -- Insertar empleado con campos de empresa
    INSERT INTO employees (
        first_name, 
        last_name, 
        pin_hash, 
        pin_text, 
        role, 
        employee_email, 
        avatar_url, 
        invite_code, 
        admin_id, 
        verified,
        company_name,
        fiscal_id
    )
    VALUES (
        p_first_name, 
        p_last_name, 
        crypt(p_pin, gen_salt('bf')), 
        p_pin, 
        v_role, 
        p_email, 
        p_avatar_url, 
        v_final_invite_code, 
        v_admin_id, 
        p_verified,
        p_company_name,
        p_fiscal_id
    )
    RETURNING id INTO v_id;
    
    -- Si es un nuevo admin, obtener email del Master Admin para notificación
    IF v_role = 'admin' AND NOT p_verified THEN
        SELECT employee_email INTO v_master_email 
        FROM employees 
        WHERE invite_code = 'CORP-18EC' AND role = 'admin'
        LIMIT 1;
    END IF;
    
    RETURN jsonb_build_object(
        'id', v_id,
        'first_name', p_first_name,
        'last_name', p_last_name,
        'role', v_role,
        'invite_code', v_final_invite_code,
        'verified', p_verified,
        'admin_email', v_master_email,
        'company_name', p_company_name,
        'fiscal_id', p_fiscal_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CONFIRMAR EJECUCIÓN
DO $$
BEGIN
    RAISE NOTICE '✅ Campos de empresa agregados correctamente';
    RAISE NOTICE '   - company_name';
    RAISE NOTICE '   - fiscal_id (DNI/NIF/CIF)';
END $$;
