-- Insert Test Users if they don't exist
-- Pepe (PIN: 5555)
INSERT INTO employees (first_name, last_name, pin_hash, role)
SELECT 'Pepe', 'Trabajador', crypt('5555', gen_salt('bf')), 'employee'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE first_name = 'Pepe');

-- Maria (PIN: 6666)
INSERT INTO employees (first_name, last_name, pin_hash, role)
SELECT 'Maria', 'Garcia', crypt('6666', gen_salt('bf')), 'employee'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE first_name = 'Maria');

-- Ensure Admin with 1234 exists (Idempotent check)
-- (Already handled in initial schema but good to be safe)
