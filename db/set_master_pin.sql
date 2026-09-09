-- ============================================================================
-- CAMBIAR EL PIN DEL ADMINISTRADOR MAESTRO
-- ============================================================================
-- El PIN anterior (01121973) estaba escrito en claro dentro de varios ficheros
-- del repositorio, así que hay que darlo por comprometido y cambiarlo.
--
-- Uso:
--   1. Sustituye NUEVO_PIN_AQUI por el PIN que quieras (8 dígitos).
--   2. Ejecútalo en el SQL Editor de Supabase.
--   3. NO guardes este fichero con el PIN dentro ni lo subas a git.
--
-- El trigger trg_hash_pin se encarga de calcular el hash bcrypt.
-- ============================================================================

UPDATE employees
   SET pin_text = 'NUEVO_PIN_AQUI'
 WHERE is_master = true;

-- Cierra cualquier sesión abierta con el PIN antiguo.
DELETE FROM sessions
 WHERE employee_id IN (SELECT id FROM employees WHERE is_master = true);

-- Comprobación: debe devolver exactamente una fila.
SELECT first_name, last_name, invite_code, is_master
  FROM employees
 WHERE is_master = true;
