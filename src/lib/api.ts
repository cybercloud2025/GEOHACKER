import { getSupabase, supabaseConfigurado } from './supabase';

/**
 * Capa única de llamada a la base de datos.
 *
 * Ya no se consultan tablas directamente: `anon` no tiene permisos sobre
 * ninguna. Todo pasa por funciones RPC que exigen el token de sesión y
 * aplican el aislamiento por empresa en el servidor.
 */

export class ApiError extends Error {
    readonly code?: string;

    constructor(message: string, code?: string) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
    }
}

/** Códigos que lanza el esquema, traducidos a mensajes para el usuario. */
const MENSAJES: Record<string, string> = {
    SESION_INVALIDA: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    PERMISO_DENEGADO: 'No tienes permisos para realizar esta acción.',
    CREDENCIALES_INVALIDAS: 'ACCESO DENEGADO',
    DEMASIADOS_INTENTOS: 'Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos.',
    CUENTA_PENDIENTE_DE_VALIDACION: 'Tu cuenta de administrador está pendiente de validación por el Administrador Maestro.',
};

/** Traduce un código del servidor a un mensaje para el usuario. */
export const mensajeDeCodigo = (codigo?: string | null): string =>
    (codigo && MENSAJES[codigo]) || 'Error desconocido';

let alCaducarSesion: (() => void) | null = null;

/** El store de autenticación se registra aquí para cerrar sesión si el token muere. */
export const onSessionExpired = (handler: () => void) => {
    alCaducarSesion = handler;
};

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!supabaseConfigurado()) {
        throw new ApiError(
            'Falta configurar la conexión con Supabase. Ve a Configuración e introduce la URL y la clave anónima.',
            'SIN_CONFIGURAR'
        );
    }

    const { data, error } = await getSupabase().rpc(fn, args);

    if (error) {
        const raw = error.message || 'Error de conexión con el servidor';
        const codigo = Object.keys(MENSAJES).find((k) => raw.includes(k));

        if (codigo === 'SESION_INVALIDA') alCaducarSesion?.();

        throw new ApiError(codigo ? MENSAJES[codigo] : raw, codigo);
    }

    return data as T;
}

/** Envuelve una acción y devuelve el resultado en el formato { success, error }. */
export async function intentar<T>(
    accion: () => Promise<T>
): Promise<{ success: boolean; error?: string; data?: T }> {
    try {
        return { success: true, data: await accion() };
    } catch (e) {
        const mensaje = e instanceof Error ? e.message : 'Error desconocido';
        return { success: false, error: mensaje };
    }
}
