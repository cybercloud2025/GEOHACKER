-- 1. Asegurar que la columna existe
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_text TEXT;

-- 2. Dar un PIN temporal a los usuarios antiguos que no lo tienen 
-- para que veas que la tabla funciona.
UPDATE employees SET pin_text = '1234' WHERE pin_text IS NULL AND role = 'employee';
UPDATE employees SET pin_text = '9270' WHERE pin_text IS NULL AND role = 'admin';

-- 3. ACTUALIZAR la función de registro para que SIEMPRE guarde el PIN visible
CREATE OR REPLACE FUNCTION register_employee(
  p_first_name TEXT,
  p_last_name TEXT,
  p_pin TEXT,
  p_role TEXT DEFAULT 'employee'
)
RETURNS JSONB AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO employees (first_name, last_name, pin_hash, pin_text, role)
  VALUES (
    p_first_name, 
    p_last_name, 
    crypt(p_pin, gen_salt('bf')), 
    p_pin, -- Aquí se guarda el PIN visible
    p_role
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'first_name', p_first_name,
    'last_name', p_last_name,
    'role', p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
