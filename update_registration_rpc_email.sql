-- ========================================================
-- UPDATE REGISTRATION RPC TO RETURN ADMIN EMAIL
-- Returns admin_email so frontend can send notification.
-- ========================================================

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
    v_admin_email TEXT;
    v_new_id UUID;
    v_new_invite_code TEXT := NULL;
BEGIN
    -- Buscar Admin por código y obtener su email también
    SELECT id, employee_email INTO v_admin_id, v_admin_email 
    FROM employees 
    WHERE invite_code = p_invite_code AND role = 'admin';
    
    IF v_admin_id IS NOT NULL THEN
        -- Registrar como Empleado
        INSERT INTO employees (
            first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, admin_id
        ) VALUES (
            p_first_name, 
            p_last_name, 
            crypt(p_pin, gen_salt('bf')), 
            p_pin, -- PIN visible
            'employee', 
            p_email, 
            p_avatar_url,
            v_admin_id
        ) RETURNING id INTO v_new_id;
        
        -- Return object now includes admin_email
        RETURN jsonb_build_object(
            'id', v_new_id, 
            'role', 'employee', 
            'admin_id', v_admin_id,
            'admin_email', v_admin_email
        );
    
    ELSE
        -- Registrar como Nuevo Admin
        IF p_invite_code = 'NEW' OR p_invite_code IS NULL THEN
             v_new_invite_code := 'CORP-' || UPPER(SUBSTRING(md5(random()::text), 1, 4));
             
             INSERT INTO employees (
                first_name, last_name, pin_hash, pin_text, role, employee_email, avatar_url, invite_code
             ) VALUES (
                p_first_name, 
                p_last_name, 
                crypt(p_pin, gen_salt('bf')), 
                p_pin, -- PIN visible
                'admin', 
                p_email, 
                p_avatar_url,
                v_new_invite_code
             ) RETURNING id INTO v_new_id;
             
             -- No admin email to return here (self-registration)
             RETURN jsonb_build_object(
                'id', v_new_id, 
                'role', 'admin', 
                'invite_code', v_new_invite_code
             );
        ELSE
            RAISE EXCEPTION 'Código de organización inválido.';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
