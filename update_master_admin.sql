-- ACTUALIZAR ADMINISTRADOR MAESTRO
-- Este script busca a todos los usuarios con rol 'admin' y les asigna 
-- el PIN '01121973' y el Código 'CORP-18EC'.

UPDATE employees
SET 
  invite_code = 'CORP-18EC',
  pin_hash = crypt('01121973', gen_salt('bf'))
WHERE role = 'admin';
