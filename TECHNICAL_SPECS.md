# ESPECIFICACIONES TÉCNICAS: GEOHACKER

## 1. Arquitectura del Sistema
GEOHACKER opera bajo una arquitectura **Serverless** moderna, desacoplando completamente el Frontend del Backend para maximizar la escalabilidad y reducir la latencia.

### 1.1 Diagrama de Flujo de Datos
`[Frontend (React/Vite)] <--> [API Gateway (Supabase)] <--> [PostgreSQL (DB & Auth)]`

- **Frontend:** Aplicación de Página Única (SPA) construida con React 19. Todo el renderizado ocurre en el cliente (CSR), lo que permite transiciones instantáneas y una experiencia tipo "app nativa".
- **Estado Global:** Gestionado por **Zustand**. Stores persistentes (`auth-storage`) mantienen la sesión del usuario activa incluso si se cierra el navegador.
- **Backend:** Supabase provee la infraestructura. No hay un servidor Node.js tradicional corriendo 24/7; en su lugar, se utilizan "Edge Functions" y llamadas RPC directas a la base de datos.

## 2. Pila Tecnológica (Tech Stack)

### Frontend Core
- **Framework:** React 19.2.0
- **Language:** TypeScript 5.9.3 (Tipado estricto)
- **Bundler:** Vite 7.2.4 (HMR instantáneo)
- **Routing:** React Router DOM 7 (Protección de rutas basada en roles)

### UI & UX
- **Styling:** Tailwind CSS 3.4 (Utility-first framework)
- **Animations:** Framer Motion (Micro-interacciones y transiciones de estado)
- **Icons:** Lucide React
- **Maps:** React Leaflet & Google Maps Integration

### Backend & Data
- **Database:** PostgreSQL 15+ (Relacional)
- **Realtime:** Supabase Channels (Websockets para estado 'Online')
- **Seguridad:** Row Level Security (RLS) policies
- **Funciones:** PL/pgSQL Stored Procedures

## 3. Esquema de Base de Datos
El núcleo del sistema reside en su diseño de base de datos relacional robusto.

### 3.1 Tabla `employees`
Almacena la identidad digital de los usuarios.
- `id` (UUID): Identificador único.
- `pin_hash` (TEXT): Hash criptográfico del PIN de acceso (Bcrypt). **Nunca se guarda el PIN en texto plano.**
- `role` (TEXT): 'admin' o 'employee'.
- `invite_code` (TEXT): Código único para trazabilidad de invitaciones.
- `verified` (BOOL): Interruptor de seguridad. Si es `false`, el usuario no puede fichar y solo tiene acceso de lectura.

### 3.2 Tabla `time_entries`
Registro inmutable de las sesiones de trabajo.
- `status` (ENUM): 'active', 'break', 'completed'.
- `start_location` / `end_location` (JSONB): Almacena latitud, longitud y precisión (radio de confianza en metros) en formato JSON para flexibilidad futura.

### 3.3 Tabla `locations`
Historial detallado de rastreo (tracklogs).
- Relación 1:N con `time_entries`.
- Captura `heading` (dirección), `speed` (velocidad), y `battery_level` (nivel de batería) para auditorías de fraude.

## 4. Seguridad y Control de Acceso

### 4.1 Autenticación Personalizada
El sistema no utiliza email/password tradicional como método primario, sino un **PIN de Acceso Rápido**.
- **Flujo:** El usuario introduce 4-6 dígitos -> Se envía al backend -> Función RPC `login_with_pin` compara el hash -> Retorna token de sesión si coincide.

### 4.2 Row Level Security (RLS)
Cada tabla tiene políticas estrictas:
- **Lectura:** Los empleados solo pueden ver sus propios registros (`uid() = employee_id`). Los administradores tienen acceso global.
- **Escritura:** Un empleado solo puede insertar coordenadas en SU propia sesión activa.

### 4.3 Sistema de Master Admin (Superusuario)
Existe un nivel superior de privilegios detectado por código duro (`CORP-18EC`).
- Capacidad de **impersonar** usuarios (ver la app como ellos).
- Capacidad de **eliminar** registros permanentemente.
- Capacidad de **validar** nuevos administradores.

## 5. Lógica de Negocio Crítica

### 5.1 Fichaje y Geolocalización
El sistema impide fichar si no se obtienen coordenadas GPS precisas.
- Utiliza `navigator.geolocation.watchPosition` para actualizaciones en tiempo real.
- Si la precisión es baja (>1000m), el sistema advierte pero permite fichar, marcando el registro como "Baja Precisión".

### 5.2 Estados de Presencia
- **Online (Punto Verde):** El usuario tiene la app abierta (tab activo). Gestionado por `PresenceManager.tsx` vía Supabase Realtime Channels.
- **Trabajando (Maletín):** El usuario tiene un registro en `time_entries` con estado 'active'.

---
**Documento Confidencial - Uso Interno Exclusivo**
