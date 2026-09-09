import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Configuración en tiempo de ejecución.
 *
 * Hay tres orígenes posibles, en este orden de prioridad:
 *
 *   1. INSTALACIÓN  — un `config.json` servido junto a la aplicación. Es lo que
 *      permite entregar una copia a cada cliente: sus empleados entran con su
 *      PIN y ya está, sin teclear credenciales en cada móvil.
 *   2. USUARIO      — lo que se guarde en /configuracion, en el navegador.
 *      Sirve para la demo y para montajes manuales.
 *   3. ENTORNO      — variables VITE_* del build. Vacías por defecto, para que
 *      la aplicación publicada no contenga credenciales de nadie.
 *
 * La instalación gana sobre el navegador a propósito: en una copia entregada a
 * un cliente, un `localStorage` viejo no debe poder desviar la aplicación a
 * otra base de datos.
 */
export interface AppConfig {
    /** Nombre visible bajo el logotipo. Vacío = se muestra solo la marca. */
    appName: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    googleMapsApiKey: string;
    emailjsPublicKey: string;
    emailjsServiceId: string;
    emailjsTemplateWelcomeId: string;
    emailjsTemplateResetId: string;
}

export type ClaveConfig = keyof AppConfig;
export type Origen = 'instalacion' | 'usuario' | 'entorno' | 'ninguno';

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const CLAVES: ClaveConfig[] = [
    'appName', 'supabaseUrl', 'supabaseAnonKey', 'googleMapsApiKey',
    'emailjsPublicKey', 'emailjsServiceId',
    'emailjsTemplateWelcomeId', 'emailjsTemplateResetId',
];

/** Valores que vienen del build. Estarán vacíos si no hay `.env`. */
const DESDE_ENTORNO: AppConfig = {
    appName: texto(import.meta.env.VITE_APP_NAME),
    supabaseUrl: texto(import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: texto(import.meta.env.VITE_SUPABASE_ANON_KEY),
    googleMapsApiKey: texto(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
    emailjsPublicKey: texto(import.meta.env.VITE_EMAILJS_PUBLIC_KEY),
    emailjsServiceId: texto(import.meta.env.VITE_EMAILJS_SERVICE_ID),
    emailjsTemplateWelcomeId: texto(import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME_ID),
    emailjsTemplateResetId: texto(import.meta.env.VITE_EMAILJS_TEMPLATE_RESET_ID),
};

const DEMO_POR_DEFECTO = texto(import.meta.env.VITE_DEMO_MODE) === 'true';

// ---------------------------------------------------------------------------
// Configuración de instalación (config.json)
// ---------------------------------------------------------------------------

/** Bloque de configuración, más la preferencia de mostrar cuentas de prueba. */
interface BloqueInstalacion extends Partial<AppConfig> {
    showDemoAccounts?: boolean;
}

/**
 * Formato de config.json. Admite dos modos:
 *
 *   Una sola copia (un cliente, un despliegue):
 *     { "supabaseUrl": "...", "supabaseAnonKey": "..." }
 *
 *   Varias copias en un mismo despliegue, una por dominio:
 *     { "tenants": { "cliente1.ejemplo.com": { "supabaseUrl": "..." } } }
 */
interface FicheroInstalacion extends BloqueInstalacion {
    tenants?: Record<string, BloqueInstalacion>;
}

let DESDE_INSTALACION: BloqueInstalacion = {};
let instalacionCargada = false;

/**
 * Lee config.json antes de que arranque la interfaz. Que no exista es el caso
 * normal en la demo, así que un 404 no es un error.
 */
export const cargarConfigInstalacion = async (): Promise<void> => {
    if (instalacionCargada) return;
    instalacionCargada = true;

    try {
        const url = `${import.meta.env.BASE_URL}config.json`;
        const respuesta = await fetch(url, { cache: 'no-store' });
        if (!respuesta.ok) return;

        // Muchos alojamientos de aplicaciones de una sola página responden a un
        // fichero inexistente con index.html y HTTP 200 en vez de un 404. Sin
        // esta comprobación intentaríamos interpretar HTML como configuración.
        if (!(respuesta.headers.get('content-type') || '').includes('json')) return;

        const datos = (await respuesta.json()) as FicheroInstalacion;
        if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return;

        // Si hay varios clientes en el mismo despliegue, manda el dominio.
        const porDominio = datos.tenants?.[window.location.hostname];
        const { tenants: _ignorado, ...raiz } = datos;
        void _ignorado;

        DESDE_INSTALACION = porDominio ? { ...raiz, ...porDominio } : raiz;
    } catch {
        // Fichero ausente o mal formado: se sigue con navegador y entorno.
        DESDE_INSTALACION = {};
    }
};

/**
 * ¿Esta copia trae sus credenciales puestas por quien la instaló?
 * Se mira solo la conexión: un config.json que traiga únicamente el nombre no
 * convierte la copia en una instalación gestionada.
 */
export const instalacionActiva = (): boolean =>
    Boolean(texto(DESDE_INSTALACION.supabaseUrl) || texto(DESDE_INSTALACION.supabaseAnonKey));

// ---------------------------------------------------------------------------
// Preferencias del navegador
// ---------------------------------------------------------------------------

interface ConfigState {
    /** Solo lo que el usuario ha introducido. Vacío = usar otro origen. */
    overrides: Partial<AppConfig>;
    /** Muestra las cuentas de prueba bajo el formulario de acceso. */
    showDemoAccounts: boolean;
    guardar: (valores: Partial<AppConfig>) => void;
    setShowDemoAccounts: (valor: boolean) => void;
    limpiar: () => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set) => ({
            overrides: {},
            showDemoAccounts: DEMO_POR_DEFECTO,

            guardar: (valores) =>
                set((estado) => {
                    const fusion: Partial<AppConfig> = { ...estado.overrides };
                    (Object.keys(valores) as ClaveConfig[]).forEach((clave) => {
                        const valor = texto(valores[clave]);
                        // Un campo vacío borra el override y devuelve el control
                        // al valor de la instalación o del entorno.
                        if (valor) fusion[clave] = valor;
                        else delete fusion[clave];
                    });
                    return { overrides: fusion };
                }),

            setShowDemoAccounts: (valor) => set({ showDemoAccounts: valor }),

            limpiar: () => set({ overrides: {} }),
        }),
        {
            name: 'geohacker-config',
            version: 1,
        }
    )
);

// ---------------------------------------------------------------------------
// Configuración efectiva
// ---------------------------------------------------------------------------

export const getConfig = (): AppConfig => {
    const { overrides } = useConfigStore.getState();
    const resultado = { ...DESDE_ENTORNO };

    CLAVES.forEach((clave) => {
        const usuario = texto(overrides[clave]);
        if (usuario) resultado[clave] = usuario;

        // La instalación tiene la última palabra.
        const instalacion = texto(DESDE_INSTALACION[clave]);
        if (instalacion) resultado[clave] = instalacion;
    });

    return resultado;
};

/** Igual que getConfig pero suscrito: el componente se repinta al guardar. */
export const useConfig = (): AppConfig => {
    useConfigStore((s) => s.overrides);
    return getConfig();
};

/** De dónde sale cada valor, para poder explicarlo en la pantalla de ajustes. */
export const origenDe = (clave: ClaveConfig): Origen => {
    if (texto(DESDE_INSTALACION[clave])) return 'instalacion';
    if (texto(useConfigStore.getState().overrides[clave])) return 'usuario';
    if (DESDE_ENTORNO[clave]) return 'entorno';
    return 'ninguno';
};

/** ¿Debe mostrarse el panel de cuentas de prueba? */
export const mostrarCuentasDemo = (): boolean => {
    if (typeof DESDE_INSTALACION.showDemoAccounts === 'boolean') {
        return DESDE_INSTALACION.showDemoAccounts;
    }
    return useConfigStore.getState().showDemoAccounts;
};

/** Versión suscrita de mostrarCuentasDemo, para usar dentro de componentes. */
export const useMostrarCuentasDemo = (): boolean => {
    useConfigStore((s) => s.showDemoAccounts);
    return mostrarCuentasDemo();
};

/** Sin esto la aplicación no puede hablar con la base de datos. */
export const supabaseConfigurado = (): boolean => {
    const { supabaseUrl, supabaseAnonKey } = getConfig();
    return Boolean(supabaseUrl && supabaseAnonKey);
};

/** Nombre para personalizar la copia. Configurable desde /configuracion. */
export const nombreApp = (): string => getConfig().appName;

export const googleMapsConfigurado = (): boolean => Boolean(getConfig().googleMapsApiKey);

export const emailConfigurado = (): boolean => {
    const c = getConfig();
    return Boolean(c.emailjsPublicKey && c.emailjsServiceId && c.emailjsTemplateWelcomeId);
};

/** Metadatos para pintar el formulario sin repetir literales por todas partes. */
export const CAMPOS: Array<{
    clave: ClaveConfig;
    etiqueta: string;
    ayuda: string;
    obligatorio: boolean;
    secreto: boolean;
    marcador: string;
}> = [
    {
        clave: 'appName',
        etiqueta: 'Nombre de la organización',
        ayuda: 'Aparece bajo el logotipo en la pantalla de acceso. Puedes dejarlo vacío.',
        obligatorio: false,
        secreto: false,
        marcador: 'Mi Empresa S.L.',
    },
    {
        clave: 'supabaseUrl',
        etiqueta: 'Supabase — URL del proyecto',
        ayuda: 'Panel de Supabase → Project Settings → Data API.',
        obligatorio: true,
        secreto: false,
        marcador: 'https://xxxxxxxx.supabase.co',
    },
    {
        clave: 'supabaseAnonKey',
        etiqueta: 'Supabase — clave anónima (anon)',
        ayuda: 'Es pública por diseño: la seguridad la aplican las políticas de la base de datos.',
        obligatorio: true,
        secreto: true,
        marcador: 'eyJhbGciOi...',
    },
    {
        clave: 'googleMapsApiKey',
        etiqueta: 'Google Maps — API key',
        ayuda: 'Google Cloud Console → APIs y servicios → Credenciales. Restríngela por referente HTTP.',
        obligatorio: false,
        secreto: true,
        marcador: 'AIzaSy...',
    },
    {
        clave: 'emailjsPublicKey',
        etiqueta: 'EmailJS — clave pública',
        ayuda: 'Solo hace falta si quieres los avisos por correo.',
        obligatorio: false,
        secreto: true,
        marcador: 'xxxxxxxxxxxx',
    },
    {
        clave: 'emailjsServiceId',
        etiqueta: 'EmailJS — Service ID',
        ayuda: 'Identificador del servicio de correo.',
        obligatorio: false,
        secreto: false,
        marcador: 'service_xxxxxxx',
    },
    {
        clave: 'emailjsTemplateWelcomeId',
        etiqueta: 'EmailJS — plantilla de bienvenida',
        ayuda: 'Se usa al dar de alta a un usuario y para avisar de altas pendientes.',
        obligatorio: false,
        secreto: false,
        marcador: 'template_xxxxxxx',
    },
    {
        clave: 'emailjsTemplateResetId',
        etiqueta: 'EmailJS — plantilla de recuperación',
        ayuda: 'Opcional.',
        obligatorio: false,
        secreto: false,
        marcador: 'template_xxxxxxx',
    },
];
