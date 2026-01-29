-- Add multi-tenancy columns
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Generate random invite code for existing ADMINS
UPDATE employees
SET invite_code = 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4))
WHERE role = 'admin' AND invite_code IS NULL;

-- Assign existing employees to the first available admin (Migration strategy)
DO $$
DECLARE
    first_admin_id UUID;
BEGIN
    SELECT id INTO first_admin_id FROM employees WHERE role = 'admin' LIMIT 1;
    
    IF first_admin_id IS NOT NULL THEN
        UPDATE employees 
        SET admin_id = first_admin_id 
        WHERE role = 'employee' AND admin_id IS NULL;
    END IF;
END $$;

-- Update verify_employee_pin to return invite_code as well
DROP FUNCTION IF EXISTS login_with_pin(TEXT);
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB AS $$
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
        'invite_code', v_employee.invite_code,
        'admin_id', v_employee.admin_id
      );
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to register new employee with invite code
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
    v_role TEXT := 'employee';
    v_new_invite_code TEXT := NULL;
BEGIN
    -- 1. Check if invite code exists (Find the Admin)
    -- IF invite code is provided, look for an admin with that code.
    -- IF invite code is 'NEW_ADMIN_SECRET', create a new admin (backdoor for demo/testing if needed, or just let users create admins without code? User said: "new admin starts empty").
    -- User request: "When a new admin is created...". implies admins can be created.
    -- FOR NOW: If no invite code, assume New Admin creation? Or specific code?
    -- Let's stick to the plan: Employees MUST enter code. Admins might need a different flow or just be created manually/via specific code.
    
    -- Let's assume:
    -- If p_invite_code is matches an existing Admin -> Register as Employee for that Admin.
    -- If p_invite_code is 'ADMIN-SETUP' (or empty/special) -> Register as New Admin.
    
    -- Logic: Find admin by code
    SELECT id INTO v_admin_id FROM employees WHERE invite_code = p_invite_code AND role = 'admin';
    
    IF v_admin_id IS NOT NULL THEN
        -- Found Admin -> Register as Employee
        INSERT INTO employees (first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, admin_id)
        VALUES (
            p_first_name, 
            p_last_name, 
            crypt(p_pin, gen_salt('bf')), 
            p_pin, -- Store visible PIN
            'employee', 
            p_email, 
            p_avatar_url,
            v_admin_id
        ) RETURNING id INTO v_new_id;
        
        RETURN jsonb_build_object('id', v_new_id, 'role', 'employee', 'admin_id', v_admin_id);
    
    ELSE
        -- Code not found or special code?
        -- If the user enters a code that doesn't exist, strictly fail?
        -- OR if they want to be an admin?
        -- Let's assume for now: If code is 'NEW', create new Admin.
        IF p_invite_code = 'NEW' OR p_invite_code IS NULL THEN
             -- Generate new invite code for this new admin
             v_new_invite_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
             
             INSERT INTO employees (first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, invite_code)
             VALUES (
                p_first_name, 
                p_last_name, 
                crypt(p_pin, gen_salt('bf')), 
                p_pin, -- Store visible PIN
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
