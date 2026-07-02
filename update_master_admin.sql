-- ACTUALIZAR ADMINISTRADOR MAESTRO
-- Este script busca a todos los usuarios con rol 'admin' y les asigna 
-- el PIN '24649270' y el Código 'CORP-18EC'.

UPDATE employees
SET 
  invite_code = 'CORP-18EC',
  pin_hash = crypt('24649270', gen_salt('bf'))
WHERE role = 'admin';
