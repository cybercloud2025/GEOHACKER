-- Asegurar que las columnas existen
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fiscal_id TEXT;

-- Verificar si existen políticas de seguridad (RLS) que bloqueen la actualización
-- (Esto habilitará la actualización para usuarios autenticados si no existe una política específica restringiéndolo)

-- Confirmar visualmente que las columnas están listas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name IN ('company_name', 'fiscal_id');
