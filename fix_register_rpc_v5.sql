-- ==============================================================================
-- DEFINITIVE FIX FOR REGISTER_EMPLOYEE_WITH_CODE (v5)
-- Consolidated logic for Admins, Employees, Multi-tenancy, and Company Fields.
-- ==============================================================================

-- 1. Ensure all required columns exist
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fiscal_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES employees(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_text TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Drop existing versions to avoid signature conflicts
DROP FUNCTION IF EXISTS register_employee_with_code(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS register_employee_with_code(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT);

-- 3. Create the definitive 9-parameter version
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
    v_target_admin_id UUID := NULL;
    v_target_admin_email TEXT := NULL;
    v_final_invite_code TEXT := p_invite_code;
    v_master_admin_id UUID;
    v_master_admin_email TEXT;
BEGIN
    -- A. Determine Role
    -- Admins are identified by 'NEW' code or PIN starting with '@'
    IF p_invite_code = 'NEW' OR LEFT(p_pin, 1) = '@' THEN
        v_role := 'admin';
        -- If it's a new admin, generate a code (Format: CORP-XXXX)
        v_final_invite_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
    ELSE
        v_role := 'employee';
    END IF;

    -- B. Find Admin to link to (Multi-tenancy)
    IF v_role = 'employee' THEN
        IF p_invite_code IS NOT NULL AND p_invite_code != '' THEN
            -- Find specific admin by code
            SELECT id, employee_email INTO v_target_admin_id, v_target_admin_email 
            FROM employees 
            WHERE invite_code = p_invite_code AND role = 'admin';
            
            IF v_target_admin_id IS NULL THEN
                RAISE EXCEPTION 'Código de organización inválido.';
            END IF;
        ELSE
            -- PUBLIC REGISTRATION (No code): Assign to Master Admin (first admin created)
            SELECT id, employee_email INTO v_target_admin_id, v_target_admin_email 
            FROM employees 
            WHERE role = 'admin' 
            ORDER BY created_at ASC 
            LIMIT 1;
            
            IF v_target_admin_id IS NULL THEN
                RAISE EXCEPTION 'No se encontró un administrador para vincular la cuenta.';
            END IF;
        END IF;
    END IF;

    -- C. Verification for Notifications (if it's a new Admin)
    -- New admins need to notify the Master Admin (CORP-18EC)
    IF v_role = 'admin' AND NOT p_verified THEN
        SELECT employee_email INTO v_target_admin_email 
        FROM employees 
        WHERE (invite_code = 'CORP-18EC' OR (role = 'admin' AND invite_code IS NOT NULL))
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    -- D. Check for duplicate PIN (Safety)
    IF EXISTS (SELECT 1 FROM employees WHERE pin_text = p_pin AND is_active = true) THEN
        RAISE EXCEPTION 'Este PIN ya está en uso por otro usuario activo.';
    END IF;

    -- E. Insert Record
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
        fiscal_id,
        is_active
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
        v_target_admin_id, 
        p_verified,
        p_company_name,
        p_fiscal_id,
        true
    )
    RETURNING id INTO v_id;

    -- F. Return object compatible with frontend expectations
    RETURN jsonb_build_object(
        'id', v_id,
        'first_name', p_first_name,
        'last_name', p_last_name,
        'role', v_role,
        'invite_code', v_final_invite_code,
        'verified', p_verified,
        'admin_id', v_target_admin_id,
        'admin_email', v_target_admin_email,
        'company_name', p_company_name,
        'fiscal_id', p_fiscal_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar CUALQUIER registro existente con el prefijo anterior
-- Esto asegura que Juan Ramón y otros pasen de PENDING-XXXX a CORP-XXXX
UPDATE employees 
SET invite_code = REPLACE(invite_code, 'PENDING-', 'CORP-') 
WHERE invite_code LIKE 'PENDING-%';

-- 5. Confirmar ejecución
SELECT 'RPC actualizada y ' || count(*) || ' códigos corregidos de PENDING a CORP.' as status 
FROM (SELECT 1 FROM employees WHERE invite_code LIKE 'CORP-%') as codes;
