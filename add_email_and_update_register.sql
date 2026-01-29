-- 1. VERIFICAR ESQUEMAS (Para ver si hay varias tablas 'employees')
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'employees';

-- 2. CAMBIAR NOMBRE DE COLUMNA (Para forzar a la API a ver algo nuevo)
-- Vamos a usar 'employee_email' en lugar de 'email' por si hay conflicto con palabras reservadas
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin_text TEXT;

-- 3. FORZAR RECARGA
NOTIFY pgrst, 'reload schema';

-- 4. TRIGGER (actualizado para la nueva columna)
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

DROP POLICY IF EXISTS "Allow anonymous registration" ON public.employees;
CREATE POLICY "Allow anonymous registration" ON public.employees
FOR INSERT WITH CHECK (true);

-- 5. ACTUALIZAR FUNCIÓN DE LOGIN (Para incluir email y avatar)
CREATE OR REPLACE FUNCTION login_with_pin(p_pin TEXT)
RETURNS JSONB AS $$
DECLARE
  v_employee RECORD;
BEGIN
  FOR v_employee IN 
    SELECT id, first_name, last_name, role, employee_email, avatar_url, pin_hash 
    FROM employees 
    WHERE is_active = true 
  LOOP
    IF v_employee.pin_hash = crypt(p_pin, v_employee.pin_hash) THEN
      RETURN jsonb_build_object(
        'id', v_employee.id,
        'first_name', v_employee.first_name,
        'last_name', v_employee.last_name,
        'role', v_employee.role,
        'employee_email', v_employee.employee_email,
        'avatar_url', v_employee.avatar_url
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. VERIFICAR COLUMNAS FINAL
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' AND table_schema = 'public';
