# DOCUMENTACIÓN TÉCNICA: GEOHACKER
**App de Geolocalización y Control de Asistencia**

## 1. Resumen General
GEOHACKER es una plataforma integral para la gestión de fuerza laboral movil. La aplicación centraliza el seguimiento de ubicación en tiempo real, el control de asistencia y la gestión de permisos administrativos en una interfaz moderna y fluida.

## 2. Arquitectura de Sistema
La aplicación sigue una arquitectura de Single Page Application (SPA) con un backend como servicio (BaaS).

- **Cliente:** React 19 (Vite) para una experiencia de usuario rápida y reactiva.
- **Estado Global:** Zustand para una gestión de estado ligera y eficiente.
- **Servidor de Datos:** Supabase maneja la base de datos PostgreSQL, la autenticación y el almacenamiento en tiempo real.
- **Geolocalización:** Integración con la API nativa de geolocalización del navegador y visualización mediante mapas interactivos de **Google Maps**.

## 3. Pila Tecnológica Detallada
| Componente | Tecnología |
| :--- | :--- |
| Framework | React 19 + TypeScript |
| Herramienta de Construcción | Vite |
| Base de Datos | Supabase (PostgreSQL) |
| Estilos | Tailwind CSS |
| Animaciones | Framer Motion |
| Mapas | Google Maps |
| Notificaciones | EmailJS |
| Gestión de Estado | Zustand |

## 4. Funcionalidades Clave
### 4.1. Panel de Registro y Login
- Acceso simplificado mediante **PIN**.
- Validación de usuarios mediante un sistema de **Master Admin**.
- Roles diferenciados: `admin` y `employee`.

### 4.2. Rastreador (Tracker)
- Botón de "Picar" (Clock-in/out) con captura de ubicación.
- Seguimiento en segundo plano de coordenadas.
- Registro de **Descansos (Breaks)** integrados en la jornada laboral.

### 4.3. Panel de Administración
- **Mapa Maestro:** Visualización de todos los empleados activos.
- **Iconografía en Tiempo Real:**
    - 🟢 Punto verde: Usuario conectado (Online).
    - 💼 Icono maletín: Usuario trabajando (Active shift).
- **Gestión de Empleados:** Editar perfiles, asignar estados de verificación y resetear PINs.

## 5. Historial de Desarrollo (Línea de Tiempo)
- **Fase 1 (Inicio):** Creación del esquema de base de datos y sistema básico de autenticación.
- **Fase 2 (Mapas):** Implementación del rastreo GPS y visualización histórica de rutas mediante Google Maps.
- **Fase 3 (Admin Panel):** Desarrollo del dashboard centralizado para supervisores.
- **Fase 4 (Seguridad):** Refuerzo de políticas de seguridad (RLS) y sistema de validación de Master Admin.
- **Fase 5 (Pulido):** Optimización de interfaz, limpieza de logs de depuración y preparación para producción.

## 6. Base de Datos (Tablas Principales)
- `employees`: Datos personales y credenciales cifradas.
- `time_entries`: Sesiones de trabajo.
- `locations`: Puntos GPS históricos.
- `breaks`: Tiempos de pausa.
- `system_settings`: Configuraciones globales de la app.

---
*Generado por Antigravity AI - Enero 2026*
