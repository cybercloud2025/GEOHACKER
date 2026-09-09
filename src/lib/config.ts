import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Configuración en tiempo de ejecución.
 *
 * Antes las claves se leían de `import.meta.env` y quedaban incrustadas en el
 * bundle al compilar: cualquiera que abriera el sitio usaba las credenciales de
 * quien lo hubiera construido. Ahora cada visitante puede introducir las suyas
 * desde /configuracion y se guardan solo en su navegador.
 *
 * El orden de prioridad es: lo que el usuario haya guardado > variables de
 * entorno > vacío. Así una instalación que ya tenga su `.env` sigue funcionando
 * igual, y un build sin `.env` no contiene ningún dato de nadie.
 */
export interface AppConfig {
    supabaseUrl: string;
    supabaseAnonKey: string;
    googleMapsApiKey: string;
    emailjsPublicKey: string;
    emailjsServiceId: string;
    emailjsTemplateWelcomeId: string;
    emailjsTemplateResetId: string;
}

export type ClaveConfig = keyof AppConfig;

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Valores que vienen del build. Estarán vacíos si no hay `.env`. */
const DESDE_ENTORNO: AppConfig = {
    supabaseUrl: texto(import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: texto(import.meta.env.VITE_SUPABASE_ANON_KEY),
    googleMapsApiKey: texto(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
    emailjsPublicKey: texto(import.meta.env.VITE_EMAILJS_PUBLIC_KEY),
    emailjsServiceId: texto(import.meta.env.VITE_EMAILJS_SERVICE_ID),
    emailjsTemplateWelcomeId: texto(import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME_ID),
    emailjsTemplateResetId: texto(import.meta.env.VITE_EMAILJS_TEMPLATE_RESET_ID),
};

const DEMO_POR_DEFECTO = texto(import.meta.env.VITE_DEMO_MODE) === 'true';

interface ConfigState {
    /** Solo lo que el usuario ha introducido. Vacío = usar el valor del entorno. */
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
                        // al valor del entorno, si lo hubiera.
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

/** Configuración efectiva: lo guardado por el usuario o, en su defecto, el entorno. */
export const getConfig = (): AppConfig => {
    const { overrides } = useConfigStore.getState();
    const resultado = { ...DESDE_ENTORNO };
    (Object.keys(DESDE_ENTORNO) as ClaveConfig[]).forEach((clave) => {
        const valor = texto(overrides[clave]);
        if (valor) resultado[clave] = valor;
    });
    return resultado;
};

/** Igual que getConfig pero suscrito: el componente se repinta al guardar. */
export const useConfig = (): AppConfig => {
    useConfigStore((s) => s.overrides);
    return getConfig();
};

/** De dónde sale cada valor, para poder explicarlo en la pantalla de ajustes. */
export const origenDe = (clave: ClaveConfig): 'usuario' | 'entorno' | 'ninguno' => {
    const { overrides } = useConfigStore.getState();
    if (texto(overrides[clave])) return 'usuario';
    if (DESDE_ENTORNO[clave]) return 'entorno';
    return 'ninguno';
};

/** Sin esto la aplicación no puede hablar con la base de datos. */
export const supabaseConfigurado = (): boolean => {
    const { supabaseUrl, supabaseAnonKey } = getConfig();
    return Boolean(supabaseUrl && supabaseAnonKey);
};

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
