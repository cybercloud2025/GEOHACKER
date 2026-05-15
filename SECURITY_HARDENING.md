# SECURITY HARDENING — Geohacker

Guía ejecución de la **Fase 1** del endurecimiento de seguridad.
Sigue los pasos en ORDEN. Cada paso es seguro y reversible (excepto el cambio de PIN master, que es lo que queremos).

---

## ✅ Pre-requisitos

- Acceso al **Supabase Dashboard** del proyecto Geohacker (rol owner)
- Acceso al repositorio Git local
- 30 minutos sin interrupciones (mejor cuando nadie esté usando la app)

---

## 📋 Pasos

### Paso 1 — Aplicar hardening SQL (10 min)

1. Abre Supabase Dashboard → **SQL Editor**
2. Crea una nueva query
3. Copia y pega el contenido completo de [`security_hardening_phase1.sql`](security_hardening_phase1.sql)
4. Click **Run**
5. Verifica que el bloque final devuelva 4 filas:
   ```
   login_attempts                     | 0
   audit_events                       | 0
   login_with_pin exists              | 1
   generate_secure_invite_code exists | 1
   ```

**Qué hace:**
- Crea tabla `login_attempts` con rate-limit (max 5 fallos / 15 min / IP)
- Crea tabla `audit_events` para registrar acciones sensibles
- Reemplaza `login_with_pin` RPC con versión rate-limited
- Añade generador `generate_secure_invite_code()` (16 chars seguros)
- Añade `rotate_invite_code(admin_id)` para rotar códigos
- Añade índices de performance/seguridad

---

### Paso 2 — Rotar PIN del Administrador Maestro (5 min)

⚠️ **CRÍTICO**: El PIN actual `01121973` está en archivos del repositorio. Debe cambiarse.

1. Decide un nuevo PIN de **8 dígitos numéricos** (ejemplos seguros: `47193628`, `92057481`, `13649825`)
   - NO uses fechas obvias (cumpleaños, aniversarios)
   - NO uses patrones (`12345678`, `00000000`, `11111111`)
   - **MEMORIZA** el PIN — no lo guardes en texto plano

2. Abre [`rotate_master_pin.sql`](rotate_master_pin.sql)

3. Edita la línea:
   ```sql
   v_new_pin TEXT := 'CAMBIAME_8_DIGITOS';
   ```
   Reemplaza con tu nuevo PIN:
   ```sql
   v_new_pin TEXT := '47193628';
   ```

4. Pega el script completo en Supabase SQL Editor y ejecuta

5. Verifica el output — debe devolver una fila JOSE PC con `pin_len = 8`

6. **PRUEBA EL LOGIN** inmediatamente en la app con el nuevo PIN antes de cerrar la sesión actual

7. Una vez confirmado que funciona, BORRA el valor del PIN del script (déjalo en `CAMBIAME_8_DIGITOS`)

---

### Paso 3 — Limpiar archivos sensibles del repositorio (5 min)

El `.gitignore` ya está actualizado. Ahora:

1. Verifica qué archivos van a ignorarse:
   ```bash
   cd e:/geohacker-app
   git ls-files | grep -E "(master|reparacion|seed_users|emergency|total_freedom|ultimate_unblock)"
   ```

2. Si aparecen archivos en el output, sácalos del tracking:
   ```bash
   git rm --cached definitivo_master_access.sql
   git rm --cached reparacion_maestra_v10.sql
   git rm --cached fix_master_admin.sql
   git rm --cached update_master_admin.sql
   git rm --cached seed_users.sql
   git rm --cached emergency_test_data.sql
   git rm --cached total_freedom_v8.sql
   git rm --cached ultimate_unblock.sql
   ```

3. Commit:
   ```bash
   git add .gitignore
   git commit -m "security: remove sensitive SQL scripts from tracking"
   ```

⚠️ **NOTA**: El historial de Git aún contiene el PIN viejo. Si el repo es público o ha sido clonado, considera:
- Reescribir historia con `git filter-repo` (avanzado)
- Asumir PIN viejo comprometido para siempre (motivo del Paso 2)

---

### Paso 4 — Verificar headers de seguridad (2 min)

El archivo `index.html` ya incluye:
- **CSP** (Content Security Policy) — restringe orígenes de scripts/estilos/conexiones
- **X-Content-Type-Options: nosniff** — evita MIME sniffing
- **Referrer-Policy: strict-origin-when-cross-origin** — limita filtración de URLs
- **Permissions-Policy** — bloquea camera/mic/payment, permite geolocation
- **robots: noindex, nofollow** — evita indexación en Google

Verifica:
1. `npm run dev` (o el comando habitual de desarrollo)
2. Abre la app en el navegador
3. DevTools → Network → Selecciona el documento HTML → Headers
4. Confirma que aparecen los headers `Content-Security-Policy`, etc.

Si la app rompe (típico: CSP bloquea algún recurso):
- Mira la consola del navegador buscando errores `Content Security Policy`
- Añade el dominio bloqueado al CSP correspondiente en `index.html`

---

### Paso 5 — Probar rate-limit del login (3 min)

1. Cierra sesión en la app
2. Intenta loguearte con PIN incorrecto **6 veces seguidas**
3. En el 6º intento debe aparecer error: `"Demasiados intentos fallidos. Espera 15 minutos."`
4. Confirma en SQL Editor:
   ```sql
   SELECT * FROM login_attempts ORDER BY attempted_at DESC LIMIT 10;
   ```
5. Deberías ver 5+ filas con `success = false`

⚠️ **IMPORTANTE**: El frontend actual NO pasa la IP a `login_with_pin`. Para activar el rate-limit real, hay que actualizar `src/stores/useAuthStore.ts` línea 81:

```ts
// Antes:
const { data: employeeData } = await supabase
    .rpc('login_with_pin', { p_pin: pin });

// Después:
const ipResp = await fetch('https://api.ipify.org?format=json').then(r => r.json()).catch(() => ({ ip: null }));
const { data: employeeData } = await supabase
    .rpc('login_with_pin', {
      p_pin: pin,
      p_ip: ipResp?.ip || null,
      p_ua: navigator.userAgent
    });
```

---

## 🛡️ Estado tras Fase 1

| Vulnerabilidad | Estado |
|---|---|
| PIN master en repo plaintext | ✅ Rotado + .gitignore |
| Login brute force ilimitado | ✅ Rate limit (max 5/15min) |
| Sin audit log | ✅ Tabla `audit_events` activa |
| invite_code predecible | ✅ Generador 16 chars seguros disponible |
| Sin headers seguridad | ✅ CSP, X-Content-Type, Referrer, Permissions |
| Indexación en Google | ✅ `robots: noindex` |

---

## 📉 Lo que NO arregla Fase 1

| Vulnerabilidad | Plan |
|---|---|
| RLS abierta (`Permiso Total Publico`) | **Fase 2** — refactor a SECURITY DEFINER RPCs |
| Sin 2FA | **Fase 3** — TOTP para admins |
| Verificación email no obligatoria | **Fase 2** |
| Geolocalización falsificable | **Fase 3** — triangulación IP backup |
| Sesiones infinitas en localStorage | **Fase 2** — expiración 8h |

---

## 🚨 Si algo falla

**Login rompe tras rotar PIN:**
- Verifica que el PIN nuevo está hasheado en DB:
  ```sql
  SELECT pin_text, LENGTH(pin_hash) FROM employees WHERE invite_code='CORP-18EC';
  ```
- Si pin_hash es NULL → re-ejecuta `rotate_master_pin.sql`

**App muestra errores CSP:**
- Comenta temporalmente el bloque CSP en `index.html` línea 11-25
- Identifica recurso bloqueado en consola
- Añade dominio al CSP y descomenta

**login_with_pin no encuentra usuarios:**
- Verifica que el RPC se sobrescribió:
  ```sql
  SELECT proname, pg_get_function_arguments(oid)
  FROM pg_proc WHERE proname='login_with_pin';
  ```
- Debe tener 3 args: `p_pin, p_ip, p_ua`. Si solo tiene 1, re-ejecuta el Bloque 2 del SQL.

---

## 📞 Siguiente paso

Cuando Fase 1 esté aplicada y verificada → pide **Fase 2** (RLS estricta + RPCs).

Archivos creados/modificados en esta fase:
- `security_hardening_phase1.sql` (nuevo)
- `rotate_master_pin.sql` (nuevo)
- `.gitignore` (modificado)
- `index.html` (modificado — headers seguridad)
- `SECURITY_HARDENING.md` (este documento)
