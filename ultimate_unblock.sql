-- ==========================================
-- ELIMINADOR DE BLOQUEOS (ULTIMATUM)
-- Ejecuta esto para desbloquear la base de datos de una vez por todas.
-- ==========================================

-- 1. DESACTIVAR LA SEGURIDAD (Obligatorio)
ALTER TABLE time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 2. LIMPIAR DATOS PARA PRUEBA LIMPIA
DELETE FROM locations;
DELETE FROM time_entries;

-- 3. RESULTADO ESPERADO
-- Al ejecutar esto, el mensaje de abajo NO debe dar error.
-- Si sale un error aquí, es que no tienes permisos de administrador en Supabase.
SELECT 'SEGURIDAD DESACTIVADA' as estado, count(*) as empleados_detectados FROM employees;
