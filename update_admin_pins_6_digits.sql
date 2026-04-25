-- Update normal admins to 6-digit PINs
-- Excluding the Master Admin associated with CORP-18EC (01121973)
-- We will pad existing PINs with '00' to reach 6 digits

UPDATE employees
SET pin_text = pin_text || '00'
WHERE role = 'admin' 
  AND invite_code != 'CORP-18EC'
  AND length(pin_text) = 4;

-- Specifically for 'manolo garcia perz' (jborladomoreno@gmail.com)
-- and 'Admin Soporte' seen in the screenshot.
