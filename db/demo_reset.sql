-- ============================================================================
-- GEOHACKER — BORRAR LOS DATOS DE DEMOSTRACIÓN
-- ============================================================================
-- Elimina únicamente las cuentas creadas por db/demo_seed.sql, identificadas
-- por el dominio @demo.geohacker.app. El borrado en cascada arrastra sus
-- fichajes, pausas, ubicaciones y sesiones.
--
-- No toca ninguna cuenta real.
-- ============================================================================

-- Qué se va a borrar (ejecútalo antes si quieres revisarlo):
SELECT first_name, last_name, pin_text, role, company_name
  FROM employees
 WHERE employee_email LIKE '%@demo.geohacker.app'
 ORDER BY role DESC, pin_text;

DELETE FROM employees WHERE employee_email LIKE '%@demo.geohacker.app';

DO $limpieza$
DECLARE v_restantes INTEGER;
BEGIN
    SELECT count(*) INTO v_restantes FROM employees
     WHERE employee_email LIKE '%@demo.geohacker.app';

    IF v_restantes = 0 THEN
        RAISE NOTICE 'Datos de demostración eliminados.';
    ELSE
        RAISE WARNING 'Quedan % cuentas de demostración.', v_restantes;
    END IF;
END
$limpieza$;
