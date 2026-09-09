# GEOHACKER

Control de asistencia y geolocalización de personal. SPA en React sobre Supabase.

**La aplicación se publica sin ninguna credencial dentro.** Cada usuario conecta
sus propios servicios desde la pantalla `/configuracion` y las claves se guardan
solo en su navegador.

| | |
| :--- | :--- |
| Frontend | React 19 + TypeScript + Vite 7 |
| Estado | Zustand (con persistencia en `localStorage`) |
| Backend | Supabase (PostgreSQL + Realtime) |
| Estilos | Tailwind CSS 3 |
| Mapas | Google Maps (`@vis.gl/react-google-maps`) |
| Correo | EmailJS (envío desde el navegador) |

---

## Probar la demo en 5 minutos

> Usa un proyecto de Supabase **exclusivo para la demo**. El seed crea cuentas
> con PIN conocidos y públicos: no deben convivir con datos reales.

1. **Crea un proyecto nuevo** en [supabase.com](https://supabase.com) (el plan
   gratuito sobra). Llámalo por ejemplo `geohacker-demo`.
2. Abre su **SQL Editor**, pega [`db/demo_full.sql`](db/demo_full.sql) entero y
   ejecútalo. Es un único fichero: esquema + datos de demostración. Al terminar
   verás en los mensajes el resumen y la lista de cuentas.
3. Arranca la app (`npm install && npm run dev`) o entra en el sitio publicado,
   y abre **`/configuracion`**.
4. Pega la **URL** y la **clave anónima** del proyecto (Supabase → *Project
   Settings* → *Data API*). La clave de Google Maps es opcional: sin ella todo
   funciona salvo los mapas.
5. Vuelve al acceso: bajo el formulario aparecen las cuentas de prueba. Pulsa
   cualquiera para entrar.

Para una instalación **real**, usa otro proyecto distinto y ejecuta solo
[`db/schema.sql`](db/schema.sql), sin el seed.

### Cuentas de la demo

| PIN | Quién | Rol | Qué se ve |
| :--- | :--- | :--- | :--- |
| `99999999` | JOSE MAESTRO | Maestro | Todas las empresas, validación de altas y suplantación de administradores |
| `@10001` | LAURA VEGA | Administrador | Logística Norte: 3 empleados, historial y mapa en vivo (Madrid) |
| `@10002` | MARCOS RUIZ | Administrador | Servicios Sur: 2 empleados, historial y mapa en vivo (Sevilla) |
| `1001` | ANA TORRES | Empleado | **Con turno abierto**: cronómetro en marcha y rastro GPS |
| `1002` | DAVID MORA | Empleado | Sin turno: sirve para probar el fichaje de entrada |
| `2001` | HUGO PRIETO | Empleado | Turno abierto en Sevilla |

El seed genera además 6 jornadas cerradas por empleado con pausas y rutas GPS,
un administrador pendiente de validar (ELENA SOTO, `@10003`) y un alta sin
asignar (IVAN RAMOS, `3001`) para probar los flujos del Maestro.

Si por lo que sea acabaste mezclando la demo con otros datos,
[`db/demo_reset.sql`](db/demo_reset.sql) borra solo las cuentas `@demo.geohacker.app`
y todo lo que cuelga de ellas.

> El panel de cuentas deja los PIN a la vista de cualquiera. Desactívalo en
> *Configuración → Mostrar cuentas de prueba* antes de usar datos reales.

---

## Configuración

Todo se introduce en **`/configuracion`**, accesible sin iniciar sesión (sin
credenciales de base de datos no se podría ni entrar). Se guarda en el
`localStorage` del navegador: no viaja a ningún servidor ni queda dentro de la
aplicación publicada.

| Ajuste | Obligatorio | Dónde se obtiene |
| :--- | :--- | :--- |
| Supabase — URL del proyecto | Sí | Supabase → Project Settings → Data API |
| Supabase — clave anónima | Sí | Igual. Es pública por diseño: la seguridad la aplica la base de datos |
| Google Maps — API key | No | Google Cloud Console → Credenciales. **Restríngela por referente HTTP** |
| EmailJS (clave, servicio, plantillas) | No | Panel de EmailJS. Sin esto no se envía ningún correo |

### Variables de entorno (alternativa)

Si prefieres que tu copia arranque ya conectada, puedes rellenar un `.env` a
partir de [`.env.example`](.env.example). Lo guardado en `/configuracion` tiene
prioridad sobre esos valores.

Ten en cuenta que **cualquier variable `VITE_*` acaba dentro del bundle**: un
build hecho con `.env` relleno lleva esas claves a quien abra el sitio. Por eso
el flujo por defecto es dejarlo vacío.

El despliegue de [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
publica sin credenciales. Para volver a inyectarlas desde los secretos del
repositorio, descomenta el bloque `env` del paso *Build*.

---

## Base de datos

**[`db/schema.sql`](db/schema.sql) es la única fuente de verdad.** Es idempotente:
se puede ejecutar sobre una base de datos nueva o sobre una existente, y trae la
migración de los datos previos. Al terminar imprime un resumen; comprueba que
diga `Permisos de tabla para anon/authenticated: 0`.

### Modelo de seguridad

La clave anónima viaja en el JavaScript que descarga cualquier visitante, así
que **todo lo que esa clave pueda hacer, lo puede hacer un desconocido**. Por eso:

- `anon` y `authenticated` no tienen **ningún** privilegio sobre las tablas.
  RLS está activo y sin políticas.
- El único acceso son 28 funciones `SECURITY DEFINER` con `GRANT EXECUTE`
  explícito. Las otras 11 del esquema son helpers internos, no expuestos.
- Salvo login y registro, todas exigen un **token de sesión** que emite
  `login_with_pin()`. El token se guarda hasheado (sha256) en `sessions`, dura
  12 horas deslizantes y se invalida al cerrar sesión o al cambiar el PIN.
- El aislamiento entre empresas lo aplica el servidor: un administrador solo
  recibe los empleados cuyo `admin_id` es el suyo. El cliente no puede pedir
  otra cosa porque no habla con las tablas.
- El PIN se guarda con bcrypt (`crypt`/`gen_salt`). El login no acepta el PIN en
  claro como alternativa al hash.
- Diez intentos fallidos desde la misma IP bloquean el login 15 minutos.

Los scripts SQL anteriores no se publican: se contradecían entre sí y algunos
abrían la base de datos o borraban el historial. Siguen recuperables desde el
historial de git (`git show c634a86 -- '*.sql'`), junto con el
`rls_hardening.sql` de la versión previa.

### Instalación con datos reales

Si partes de una base de datos existente, cambia el PIN del Administrador
Maestro con [`db/set_master_pin.sql`](db/set_master_pin.sql): el anterior
(`01121973`) estaba escrito en claro en varios ficheros del repositorio.

---

## Roles

| Rol | Alcance |
| :--- | :--- |
| **Empleado** | Ficha entrada/salida y pausas. Su posición se registra solo mientras tiene un turno abierto. |
| **Administrador** | Ve el historial, el mapa en vivo y los empleados **de su organización**. Alta y edición de sus empleados. |
| **Administrador Maestro** | Marcado con `employees.is_master`. Valida altas de administradores, asigna empleados a una organización, cambia roles y puede suplantar a otro usuario. |

El PIN también marca el formato: 4 dígitos para empleado, `@` + 5 dígitos para
administrador. El rol real vive en `employees.role`; el formato del PIN es solo
una convención de entrada.

### Altas

- **Empleado con código de empresa** → entra en esa organización, pendiente de
  que su administrador lo valide.
- **Empleado sin código** → queda sin asignar; el Maestro lo coloca desde
  *Usuarios → Validar y Asignar*.
- **Administrador** (`/admin-register`) → queda pendiente de validación del
  Maestro y no puede entrar hasta entonces.

---

## Scripts

| Comando | Qué hace |
| :--- | :--- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `tsc -b` + build de Vite + genera `404.html` para el enrutado SPA |
| `npm run lint` | ESLint |
| `npm run preview` | Sirve el build local |
| `npm run db:demo` | Regenera `db/demo_full.sql` a partir del esquema y el seed |

> `base` en [`vite.config.ts`](vite.config.ts) debe ser `'/'` mientras exista
> [`public/CNAME`](public/CNAME). Si algún día se sirve desde
> `usuario.github.io/GEOHACKER/`, hay que poner `base: '/GEOHACKER/'` **y**
> añadir `basename="/GEOHACKER"` al `BrowserRouter` de [`src/App.tsx`](src/App.tsx).

---

## Estructura

```
db/
  schema.sql          Esquema único: tablas, RPC, permisos y migración
  demo_seed.sql       Mundo de demostración (cuentas, fichajes, rutas GPS)
  demo_full.sql       Generado: schema + seed en un solo pegado
  demo_reset.sql      Borra solo los datos de demostración
  set_master_pin.sql  Plantilla para cambiar el PIN maestro
scripts/
  build-demo-sql.js   Genera demo_full.sql (npm run db:demo)
src/
  lib/
    config.ts         Configuración en tiempo de ejecución (claves del usuario)
    api.ts            Única puerta a la base de datos: rpc() + errores
    supabase.ts       Cliente, reconstruido si cambian las credenciales
    googleMaps.ts     Tipos del global `google`
    email.ts          EmailJS
    demoAccounts.ts   Cuentas que pinta el panel del acceso
  stores/             Zustand: auth (sesión y token), tiempos, presencia
  hooks/              useLocationTracker: GPS mientras hay turno abierto
  pages/              Login, Tracker, Admin, AdminMap, AdminRegister, Settings
  components/         UI, modales de administración, mapas y panel de demo
```

---

## Limitaciones conocidas

- **El aviso por correo de un alta pendiente** se envía desde el navegador con
  EmailJS, así que el RPC de registro devuelve la dirección del administrador
  destinatario para poder mandarlo. Se ha quitado el PIN de ese aviso, pero la
  dirección sigue siendo visible para quien se registra. Eliminarlo del todo
  exige mover el envío a un Edge Function.
- **El indicador "conectado"** usa Realtime Presence, donde cada cliente declara
  su propio identificador. Es un dato cosmético y no controla ningún permiso.
- **`src/components/Admin/SearchAdminModal.tsx`** no está enlazado desde ninguna
  pantalla.
