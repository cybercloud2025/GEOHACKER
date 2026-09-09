/**
 * Cuentas del juego de datos de demostración (db/demo_seed.sql).
 *
 * Esta lista es solo para pintar los accesos rápidos del login. No concede
 * ningún permiso por sí misma: el PIN se valida contra la base de datos igual
 * que cualquier otro, así que si no se ha ejecutado el seed, no entra nadie.
 */

export type RolDemo = 'maestro' | 'admin' | 'empleado';

export interface CuentaDemo {
    pin: string;
    nombre: string;
    rol: RolDemo;
    empresa: string;
    /** Qué se puede ver entrando con esta cuenta. */
    descripcion: string;
}

export const CUENTAS_DEMO: CuentaDemo[] = [
    {
        pin: '99999999',
        nombre: 'JOSE MAESTRO',
        rol: 'maestro',
        empresa: 'GEOHACKER Central',
        descripcion: 'Ve todas las empresas, valida altas y puede entrar como cualquier administrador.',
    },
    {
        pin: '@10001',
        nombre: 'LAURA VEGA',
        rol: 'admin',
        empresa: 'Logística Norte S.L.',
        descripcion: 'Panel con sus 3 empleados, historial y mapa en vivo (Madrid).',
    },
    {
        pin: '@10002',
        nombre: 'MARCOS RUIZ',
        rol: 'admin',
        empresa: 'Servicios Sur S.A.',
        descripcion: 'Panel con sus 2 empleados, historial y mapa en vivo (Sevilla).',
    },
    {
        pin: '1001',
        nombre: 'ANA TORRES',
        rol: 'empleado',
        empresa: 'Logística Norte S.L.',
        descripcion: 'Tiene un turno abierto ahora mismo: entra y verás el cronómetro en marcha.',
    },
    {
        pin: '1002',
        nombre: 'DAVID MORA',
        rol: 'empleado',
        empresa: 'Logística Norte S.L.',
        descripcion: 'Sin turno abierto: sirve para probar el fichaje de entrada.',
    },
    {
        pin: '2001',
        nombre: 'HUGO PRIETO',
        rol: 'empleado',
        empresa: 'Servicios Sur S.A.',
        descripcion: 'Turno abierto en Sevilla, con rastro GPS de las últimas horas.',
    },
];

export const ETIQUETA_ROL: Record<RolDemo, string> = {
    maestro: 'Maestro',
    admin: 'Administrador',
    empleado: 'Empleado',
};

/** Clases Tailwind por rol, para que cada tipo de cuenta se distinga de un vistazo. */
export const ESTILO_ROL: Record<RolDemo, string> = {
    maestro: 'border-red-500/40 text-red-400 bg-red-500/5 hover:bg-red-500/10',
    admin: 'border-purple-500/40 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10',
    empleado: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10',
};
