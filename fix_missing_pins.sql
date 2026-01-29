-- ========================================================
-- FIX MISSING PINs (Visibility)
-- ========================================================

-- 1. Ensure pin_text column exists (it should, but just in case)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_text TEXT;

-- 2. Populate pin_text for the Master Admin (JOSE PC)
-- We know his PIN from previous setup scripts (01121973)
UPDATE employees 
SET pin_text = '01121973' 
WHERE invite_code = 'CORP-18EC' AND first_name = 'JOSE';

-- 3. Populate pin_text for test users if they exist
UPDATE employees SET pin_text = '1234' WHERE first_name = 'John' AND last_name = 'Doe' AND pin_text IS NULL;

-- Note: For other users where the PIN is unknown (hashed), 
-- they will continue to show '----' until updated or re-registered.
-- This is a security limitation of salted hashing.
