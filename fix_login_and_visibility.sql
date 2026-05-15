-- ==============================================================================
-- FIX FOR LOGIN AND USER VISIBILITY
-- 1. Updates login_with_pin to return all necessary session data.
-- 2. Ensures the Master Admin record is correctly identified for the frontend.
-- ==============================================================================

-- 1. Update login_with_pin to return all necessary fields
-- This ensures the frontend correctly identifies the admin's invite_code and admin_id.
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB AS $$
DECLARE
    v_employee RECORD;
BEGIN
    FOR v_employee IN 
        SELECT * FROM employees 
        WHERE (is_active IS NOT FALSE)
    LOOP
        -- Check PIN hash
        IF v_employee.pin_hash = crypt(p_pin, v_employee.pin_hash) THEN
            RETURN jsonb_build_object(
                'id', v_employee.id,
                'first_name', v_employee.first_name,
                'last_name', v_employee.last_name,
                'role', v_employee.role,
                'verified', COALESCE(v_employee.verified, false),
                'admin_id', v_employee.admin_id,
                'invite_code', v_employee.invite_code,
                'employee_email', v_employee.employee_email,
                'company_name', v_employee.company_name,
                'fiscal_id', v_employee.fiscal_id,
                'avatar_url', v_employee.avatar_url
            );
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure Master Admin identity
-- The frontend is hardcoded to look for 'CORP-18EC' for super-admin privileges.
-- This ensures the first admin (Master) actually has that code.
DO $$
DECLARE
    v_master_id UUID;
BEGIN
    -- Find the first admin created
    SELECT id INTO v_master_id FROM employees WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
    
    IF v_master_id IS NOT NULL THEN
        UPDATE employees 
        SET invite_code = 'CORP-18EC', verified = true
        WHERE id = v_master_id;
    END IF;
END $$;

-- 3. Confirm execution
SELECT 'Login RPC updated and Master Admin identity verified.' as result;
