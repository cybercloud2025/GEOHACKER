# FASE 2 — RLS Endurecida + RPCs SECURITY DEFINER

Esta fase **bloquea el acceso directo de `anon` a las tablas** y obliga a que toda lectura/escritura pase por RPCs `SECURITY DEFINER` con validación.

**Pre-requisito**: Fase 1 aplicada ([SECURITY_HARDENING.md](SECURITY_HARDENING.md)).

---

## 🎯 Resumen

| Componente | Estado tras Fase 2 |
|---|---|
| Acceso directo de `anon` a `employees` | ❌ Bloqueado |
| Acceso directo de `anon` a `time_entries` | ❌ Bloqueado |
| Acceso directo de `anon` a `locations` | ❌ Bloqueado |
| Acceso directo de `anon` a `breaks` | ❌ Bloqueado |
| Acceso directo de `anon` a `system_settings` | ❌ Bloqueado |
| Frontend funcional vía 15 RPCs `SECURITY DEFINER` | ✅ |
| Sesión expira a las 8h | ✅ |
| Login envía IP/User-Agent (activa rate-limit Fase 1) | ✅ |
| Audit log automático en cambios sensibles | ✅ |

---

## 📋 Orden de ejecución (CRÍTICO)

⚠️ **NO bloquees RLS antes de desplegar el frontend nuevo.** Si lo haces, la app vivirá en producción rota.

### Orden correcto:

1. **Desplegar código frontend nuevo** (build + commit + push)
2. **Aplicar SQL hasta sección D** (crea RPCs sin bloquear nada)
3. **Probar app** — debe seguir funcionando
4. **Aplicar SQL sección E** (cierra RLS)
5. **Probar app de nuevo** — debe seguir funcionando

---

## 🚀 Paso a paso

### Paso 1 — Build y deploy frontend (5 min)

```bash
cd e:/geohacker-app
npm install                # por si acaso
npm run build              # genera dist/
# Sube dist/ a tu hosting (Vercel/Netlify/Cloudflare/lo que uses)
```

Si tu deploy es automático con `git push`, simplemente:

```bash
git add src/ index.html .gitignore
git commit -m "security: refactor to SECURITY DEFINER RPCs + session expiry + CSP headers"
git push
```

Espera al deploy. Verifica en producción que la app sigue funcionando (login, fichaje, panel admin).

---

### Paso 2 — Aplicar RPCs (sección A-D del SQL) (3 min)

1. Abre Supabase Dashboard → SQL Editor
2. Abre [`fase2_rls_rpcs.sql`](fase2_rls_rpcs.sql)
3. **Selecciona desde la línea 1 hasta justo antes de la sección E** (líneas 1-~340 aprox; el comentario "SECCIÓN E — BLOQUEO RLS" lo marca)
4. Pega y ejecuta solo esa porción
5. Verifica que no hay errores

Esto crea las 15 RPCs nuevas pero **NO bloquea RLS aún**. La app sigue funcionando exactamente igual que antes.

---

### Paso 3 — Validación intermedia (3 min)

Antes de bloquear RLS, confirma que la app sigue OK:

- Login con PIN master ✅
- Ver historial de turnos ✅
- Ver pestaña Mapa en Vivo ✅
- Ver pestaña Usuarios ✅
- Ver pestaña Administradores ✅
- Fichar entrada y salida con un empleado de prueba ✅

Si algo falla, mira la consola del navegador. La causa típica es una RPC que no se creó. Re-ejecuta el SQL.

---

### Paso 4 — Bloquear RLS (sección E del SQL) (2 min)

1. Vuelve al SQL Editor
2. Esta vez selecciona **solo la sección E + F** (desde `SECCIÓN E — BLOQUEO RLS` hasta el final)
3. Ejecuta

Esto:
- Elimina las políticas abiertas `"Permiso Total Publico"`
- Crea políticas `deny_anon_*` que niegan TODO acceso directo
- El acceso solo pasa por las RPCs `SECURITY DEFINER`

La query de verificación al final debe devolver:

```
RPCs creadas                        | 15
Políticas RESTRICTIVE deny activas  | 5
```

---

### Paso 5 — Validación final (5 min)

1. **Recarga la app en el navegador** (F5)
2. Repite los checks del Paso 3
3. Abre DevTools → Network → verifica que las peticiones a Supabase devuelven `200 OK` y datos
4. Intenta desde DevTools Console:
   ```js
   await window.supabase?.from('employees').select('*')
   ```
   Debe devolver **vacío** o error de permisos. Es la confirmación de que `anon` ya no puede leer tablas directamente.

---

## 🔄 Rollback de emergencia

Si la app rompe tras Paso 4, ejecuta esto en SQL Editor:

```sql
DROP POLICY IF EXISTS "deny_anon_employees"    ON employees;
DROP POLICY IF EXISTS "deny_anon_time_entries" ON time_entries;
DROP POLICY IF EXISTS "deny_anon_locations"    ON locations;
DROP POLICY IF EXISTS "deny_anon_breaks"       ON breaks;
DROP POLICY IF EXISTS "deny_anon_settings"     ON system_settings;

CREATE POLICY "Permiso Total Publico" ON employees      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON time_entries   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON locations      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON breaks         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso Total Publico" ON system_settings FOR ALL USING (true) WITH CHECK (true);
```

Esto te devuelve al estado previo (igual de inseguro que antes, pero funcional). Las RPCs nuevas siguen ahí sin daño.

---

## 📁 Archivos modificados/creados en Fase 2

### Nuevos
- `fase2_rls_rpcs.sql` — bundle SQL con 15 RPCs + RLS lock
- `FASE2_EJECUCION.md` — esta guía

### Modificados (frontend)
- `src/stores/useAuthStore.ts`
  - `loginWithPin` envía IP + User-Agent al RPC `login_with_pin` (activa rate-limit de Fase 1)
  - `fetchSettings` usa `get_system_setting` RPC
  - `toggleRegistration` usa `set_system_setting` RPC
  - `updateEmployee` usa `update_employee_safe` RPC
  - Sesión expira tras 8h (campo `sessionStartedAt` + `onRehydrateStorage`)

- `src/stores/useTimeStore.ts`
  - `syncStatus` usa `get_active_shift` RPC
  - `startBreak` usa `start_break_safe` RPC
  - `endBreak` usa `end_break_safe` RPC

- `src/hooks/useLocationTracker.tsx`
  - Insert GPS usa `insert_location_safe` RPC (incluye validación de turno activo y rango GPS)

- `src/pages/Admin.tsx`
  - `fetchUsers` usa `get_users_for_admin` RPC
  - `fetchActiveUsers` usa `get_active_employee_ids` RPC
  - `fetchAdmins` usa `get_admins_list` RPC
  - `toggleUserRole` usa `update_user_role` RPC
  - `handleDeleteUser` usa `delete_employee_safe` RPC

- `src/components/Admin/LiveUserMap.tsx`
  - Turnos activos usa `get_active_shifts_with_employees` RPC
  - Última localización usa `get_latest_location` RPC

- `src/components/Admin/AssignAdminModal.tsx`
  - Lista admins disponibles usa `get_admins_for_assignment` RPC

---

## 🔍 Auditoría — ver quién hizo qué

A partir de Fase 2, cada cambio de rol, borrado de usuario o cambio de setting queda registrado:

```sql
-- Últimas 50 acciones sensibles
SELECT
  e.event_type,
  a.first_name || ' ' || a.last_name AS actor,
  t.first_name || ' ' || t.last_name AS target,
  e.payload,
  e.created_at
FROM audit_events e
LEFT JOIN employees a ON a.id = e.actor_id
LEFT JOIN employees t ON t.id = e.target_id
ORDER BY e.created_at DESC
LIMIT 50;
```

```sql
-- Intentos de login fallidos por IP
SELECT
  ip_address,
  COUNT(*) FILTER (WHERE success = false) AS fallos,
  COUNT(*) FILTER (WHERE success = true) AS exitos,
  MAX(attempted_at) AS ultimo_intento
FROM login_attempts
WHERE attempted_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
ORDER BY fallos DESC;
```

---

## 📈 Estado post-Fase 2

| Vector de ataque | Estado |
|---|---|
| Brute force PIN | ✅ Rate-limited (5 fallos / 15 min / IP) |
| Lectura directa de DB con `anon key` | ✅ Bloqueada por RLS |
| Escritura directa de DB con `anon key` | ✅ Bloqueada por RLS |
| Borrado del Master Admin | ✅ Bloqueado en `delete_employee_safe` |
| Cambio de rol por no-admin | ✅ Bloqueado en `update_user_role` |
| Modificación de settings por no-admin | ✅ Bloqueado en `set_system_setting` |
| Inyección de GPS fuera de rango | ✅ Validado en `insert_location_safe` |
| Sesión robada en localStorage | ⚠️ Mitigado (expira 8h, no eterno) |
| Indexación en Google | ✅ `noindex` meta tag |
| Predicción de invite_code | ✅ Generador 16 chars (rota viejos con `rotate_invite_code`) |

---

## 📌 Lo que SIGUE pendiente (Fase 3)

| Tema | Por qué importa |
|---|---|
| 2FA TOTP para admins | Master sin 2FA = SPOF si comprometido |
| Verificación email obligatoria | Hoy se puede registrar con email falso |
| Triangulación IP de geolocalización | GPS del browser es falsificable con extensiones |
| Cifrado en reposo de PII (email, fiscal_id) | GDPR + minimiza daño si DB se filtra |
| Backups Point-in-Time Recovery | Requiere plan Pro de Supabase |
| Sentry/monitoring frontend | Detectar patrones anómalos en producción |
| Rotación automática `invite_code` cada N meses | Si código se filtra, ventana corta |

---

## 🎬 Resumen ejecución

```
1. git push (deploys nuevo frontend)
2. SQL Editor → pegar líneas 1-340 de fase2_rls_rpcs.sql → Run
3. Probar app
4. SQL Editor → pegar líneas 341-final → Run
5. Probar app
6. Listo. RLS bloqueada. Frontend funcional.
```

Tiempo total: 15-20 minutos.
