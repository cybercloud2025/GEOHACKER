DO $$ 
DECLARE
  v_code_exists BOOLEAN;
BEGIN
  -- 1. Check if the code 'CORP-18EC' is already assigned to someone
  SELECT EXISTS(SELECT 1 FROM employees WHERE invite_code = 'CORP-18EC') INTO v_code_exists;
  
  IF v_code_exists THEN
    -- CASE A: User already has this code. Update their PIN and make sure they are Admin.
    UPDATE employees 
    SET 
        pin_hash = crypt('01121973', gen_salt('bf')), 
        role = 'admin'
    WHERE invite_code = 'CORP-18EC';
    
    RAISE NOTICE 'Updated existing user with code CORP-18EC';
    
  ELSE
    -- CASE B: Code is free. Assign it to ONE existing admin.
    -- (We use LIMIT 1 to avoid "duplicate key" error if multiple admins exist)
    UPDATE employees
    SET 
      invite_code = 'CORP-18EC',
      pin_hash = crypt('01121973', gen_salt('bf'))
    WHERE id = (SELECT id FROM employees WHERE role = 'admin' LIMIT 1);
    
    RAISE NOTICE 'Assigned Master credentials to one admin';
  END IF;
END $$;
