# FASE 3 — 2FA + Email Verification + PII Encryption + Sentry

Capa adicional sobre Fase 1+2. Añade:
- **2FA TOTP** para administradores (Google Authenticator, Authy, 1Password)
- **Verificación obligatoria de email** con tokens de 24h
- **Cifrado PII en reposo** (email, fiscal_id) — opcional, comentado en SQL
- **Sentry** para monitoring de errores en producción (sin DSN = no-op)

**Pre-requisito**: Fase 1+2 aplicadas.

---

## 📦 Archivos creados

### SQL
- [fase3_security.sql](fase3_security.sql) — tablas `email_verification_tokens`, `user_2fa` + 10 RPCs

### Frontend
- [src/lib/sentry.ts](src/lib/sentry.ts) — init Sentry con masking de PII
- [src/main.tsx](src/main.tsx) — llama `initSentry()` al arrancar
- [src/components/EmailVerificationBanner.tsx](src/components/EmailVerificationBanner.tsx) — banner que aparece a usuarios sin email verificado
- [src/components/layout/AppLayout.tsx](src/components/layout/AppLayout.tsx) — incluye el banner
- [src/components/Admin/TwoFactorSetupModal.tsx](src/components/Admin/TwoFactorSetupModal.tsx) — modal 4 pasos (intro → QR → verify → backup codes)
- [src/components/TwoFactorChallengeModal.tsx](src/components/TwoFactorChallengeModal.tsx) — modal de challenge en login
- [src/stores/useAuthStore.ts](src/stores/useAuthStore.ts) — campos `pending2FA`, `complete2FALogin`, `cancel2FALogin`
- [src/pages/Login.tsx](src/pages/Login.tsx) — renderiza challenge si login indica `requires2FA`
- [src/pages/Admin.tsx](src/pages/Admin.tsx) — botón `2FA` en header del panel admin

### package.json
- Nuevas dependencias: `otplib`, `qrcode`, `@sentry/react`, `@types/qrcode`

---

## 🚀 Paso a paso

### Paso 1 — Instalar dependencias (1 min)

```bash
cd e:/geohacker-app
npm install
```

Verifica que se instalan sin errores `otplib`, `qrcode`, `@sentry/react`.

---

### Paso 2 — Configurar Sentry (opcional, 5 min)

Si quieres monitoring de errores en producción:

1. Crea cuenta gratis en https://sentry.io
2. Crea un proyecto tipo `React`
3. Copia el DSN
4. En tu hosting (Vercel/Netlify), añade variable de entorno:
   ```
   VITE_SENTRY_DSN=https://xxxxx@oXXXXX.ingest.sentry.io/XXXXX
   ```
5. Re-deploy

Si **no** configuras DSN: Sentry queda inactivo silenciosamente (no rompe nada).

⚠️ Configurado para no enviar PII: emails, IPs y cookies se eliminan antes del envío.

---

### Paso 3 — Aplicar SQL en Supabase (3 min)

1. Abre Supabase Dashboard → SQL Editor
2. Pega el contenido completo de [fase3_security.sql](fase3_security.sql)
3. **NO ejecutes la sección C (PII encryption)** todavía — está comentada por defecto, descomenta solo cuando hayas verificado backups
4. Run

Verificación esperada:
```
email_verification_tokens table | 1
user_2fa table                  | 1
email_verified column           | 1
2FA RPCs created                | 6
Email RPCs created              | 2
```

---

### Paso 4 — Deploy frontend (5 min)

```bash
git add .
git commit -m "security: phase 3 - 2FA, email verification, Sentry"
git push
```

Espera el deploy automático.

---

### Paso 5 — Activar 2FA en cuentas admin (5 min cada una)

⚠️ **Empieza por el Master JOSE PC**. Si pierdes acceso, el Master es quien puede recuperar.

Para cada admin:
1. Login normal
2. Click botón **2FA** en header del panel admin
3. Click **Comenzar configuración**
4. Abre Google Authenticator / Authy / 1Password
5. Escanea el QR (o copia el secret manualmente)
6. Introduce el código de 6 dígitos que muestra la app
7. **GUARDA los 10 códigos de respaldo** (se muestran SOLO UNA VEZ)
8. Click **Los he guardado**

Próximo login pedirá:
- PIN actual
- Código TOTP de 6 dígitos
- O un código de respaldo de 8 dígitos

---

### Paso 6 — Habilitar PII encryption (opcional, AVANZADO)

⚠️ **Esto modifica datos sensibles. Haz backup completo antes.**

En Supabase Dashboard:

1. Ve a `Database` → `Backups` y descarga snapshot manual
2. Configura clave de cifrado:
   ```sql
   ALTER DATABASE postgres SET app.pii_key = 'TU_CLAVE_ALEATORIA_DE_64_CHARS_MINIMO';
   SELECT pg_reload_conf();
   ```
   **GUARDA esta clave en un gestor de contraseñas seguro.** Sin ella, los datos cifrados son irrecuperables.

3. En `fase3_security.sql`, descomenta el bloque dentro de `/* ... */` de la sección C
4. Ejecuta solo ese bloque
5. Verifica que las columnas `_enc` están pobladas:
   ```sql
   SELECT id, employee_email IS NOT NULL AS has_plain,
                employee_email_enc IS NOT NULL AS has_enc
   FROM employees WHERE employee_email IS NOT NULL;
   ```
6. Cuando confirmes que el descifrado funciona vía `get_employee_pii()`, **borra las columnas plaintext** (último paso, comentado en SQL)

---

## 🔐 Cómo usar 2FA tras configurarlo

### Login normal
1. Introduce PIN como siempre
2. Sistema detecta 2FA activo → muestra modal de challenge
3. Introduce código de 6 dígitos de tu app
4. Acceso otorgado

### Perdí el móvil con la app autenticadora
1. En login, después del PIN, usa un código de respaldo (8 dígitos)
2. Cada código se consume tras uso
3. Si te quedan pocos, reconfigura 2FA desde el panel

### Master puede desactivar 2FA de otro admin
```sql
SELECT disable_2fa(
  'UUID_DEL_USUARIO',
  'UUID_DEL_MASTER'
);
```

---

## 📊 Auditoría 2FA

```sql
-- Quién tiene 2FA activo
SELECT
  e.first_name || ' ' || e.last_name AS admin,
  u.enabled,
  u.last_used_at,
  u.created_at
FROM user_2fa u
JOIN employees e ON e.id = u.employee_id
ORDER BY u.created_at DESC;

-- Últimos eventos 2FA
SELECT
  event_type,
  e.first_name || ' ' || e.last_name AS user,
  created_at
FROM audit_events ae
LEFT JOIN employees e ON e.id = ae.actor_id
WHERE event_type LIKE '2fa_%'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🚨 Si algo rompe

### TypeError: authenticator.generateSecret is not a function
- `npm install` no completó. Re-ejecuta y verifica que `node_modules/otplib` existe.

### El botón 2FA no aparece en Admin
- Hard refresh del navegador (Ctrl+Shift+R)
- Verifica que el build incluye `TwoFactorSetupModal`

### Login en bucle pidiendo 2FA
- En SQL Editor:
  ```sql
  UPDATE user_2fa SET enabled = FALSE WHERE employee_id = 'TU_UUID';
  ```
- Reconfigura desde el panel

### Banner de email no desaparece tras verificar
- El campo `email_verified` debe ser TRUE. Comprueba:
  ```sql
  SELECT id, employee_email, email_verified FROM employees WHERE id = 'TU_UUID';
  ```

---

## 📈 Estado final del sistema (Fase 1+2+3)

| Vector | Estado |
|---|---|
| Brute force PIN | ✅ Rate-limited |
| RLS abierta | ✅ Bloqueada (Fase 2) |
| PIN master en repo | ✅ Rotado + .gitignore |
| Audit log | ✅ Activo |
| Sesión infinita | ✅ Expira 8h |
| Headers seguridad | ✅ CSP + X-Content + Referrer + Permissions |
| Verificación email obligatoria | ✅ Banner + token 24h |
| 2FA admins | ✅ TOTP + backup codes |
| GPS falsificable | ✅ Validado rango + ligado a turno activo |
| Monitoring | ✅ Sentry con masking PII |
| Cifrado PII en reposo | ⚠️ Opcional (requiere clave + backup) |

---

## 📌 Lo que sigue pendiente (Fase 4, futuras)

- **Migración a Supabase Auth nativo** — reemplazaría el sistema PIN custom por email+password+MFA gestionado por Supabase. Refactor grande.
- **Triangulación IP del GPS** — backend valida que la IP del cliente y la geolocalización declarada cuadran (requiere geoip DB)
- **Point-in-Time Recovery** — plan Pro de Supabase ($25/mes)
- **WAF / Cloudflare frente a la app** — bloqueo de bots y patrones de ataque

---

## 🎬 Resumen ejecución

```
1. npm install                       (1 min)
2. (Opcional) Sentry DSN env var     (5 min)
3. SQL Editor → fase3_security.sql   (3 min)
4. git push                          (5 min)
5. Activar 2FA en cada admin         (5 min × N admins)
6. (Avanzado) PII encryption         (15 min)
```

Total: 15-30 minutos según número de admins.
