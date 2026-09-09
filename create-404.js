import fs from 'fs';
import path from 'path';

/**
 * Ajustes posteriores al build.
 *
 * 1. 404.html — GitHub Pages lo sirve cuando la ruta no existe como fichero.
 *    Al ser una copia de index.html, el enrutado del navegador sigue
 *    funcionando al recargar en /admin o /configuracion.
 *
 * 2. CNAME — el dominio propio, si lo hay, desde PAGES_CNAME.
 *
 * 3. config.json — la configuración de ESTA copia, desde variables de entorno.
 *    Es lo que permite que un mismo repositorio produzca una instalación
 *    distinta por cliente: cada despliegue define sus variables y sus empleados
 *    entran solo con el PIN, sin tocar nada.
 *
 * Nada de esto vive en el código: el repositorio no contiene ni dominios ni
 * credenciales de nadie.
 */

const distDir = path.resolve('dist');
const indexFile = path.join(distDir, 'index.html');

if (!fs.existsSync(indexFile)) {
    console.error('❌ No existe dist/index.html. El build ha fallado.');
    process.exit(1);
}

// --- 1. 404.html --------------------------------------------------------
fs.copyFileSync(indexFile, path.join(distDir, '404.html'));
console.log('✅ 404.html creado a partir de index.html');

// --- 2. CNAME -----------------------------------------------------------
const dominio = (process.env.PAGES_CNAME || '').trim();

if (dominio) {
    fs.writeFileSync(path.join(distDir, 'CNAME'), `${dominio}\n`, 'utf8');
    console.log(`✅ CNAME creado para ${dominio}`);
} else {
    console.log('ℹ️  Sin PAGES_CNAME: no se genera CNAME.');
}

// --- 3. config.json -----------------------------------------------------

/** Variable de entorno que alimenta cada clave del fichero. */
const VARIABLES = {
    appName: 'CONFIG_APP_NAME',
    supabaseUrl: 'CONFIG_SUPABASE_URL',
    supabaseAnonKey: 'CONFIG_SUPABASE_ANON_KEY',
    googleMapsApiKey: 'CONFIG_GOOGLE_MAPS_API_KEY',
    emailjsPublicKey: 'CONFIG_EMAILJS_PUBLIC_KEY',
    emailjsServiceId: 'CONFIG_EMAILJS_SERVICE_ID',
    emailjsTemplateWelcomeId: 'CONFIG_EMAILJS_TEMPLATE_WELCOME_ID',
    emailjsTemplateResetId: 'CONFIG_EMAILJS_TEMPLATE_RESET_ID',
};

const configPath = path.join(distDir, 'config.json');
const valor = (nombre) => (process.env[nombre] || '').trim();

// APP_CONFIG permite pegar el JSON entero. Hace falta para el modo con varios
// dominios en un mismo despliegue ("tenants"), que no cabe en variables sueltas.
const crudo = valor('APP_CONFIG');

if (crudo) {
    try {
        const objeto = JSON.parse(crudo);
        if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
            throw new Error('APP_CONFIG debe ser un objeto JSON.');
        }
        fs.writeFileSync(configPath, JSON.stringify(objeto, null, 2) + '\n', 'utf8');
        console.log('✅ config.json creado desde APP_CONFIG');
    } catch (error) {
        // Un config.json corrupto dejaría la copia sin conexión y sin aviso
        // claro, así que es mejor romper el build aquí.
        console.error('❌ APP_CONFIG no es JSON válido:', error.message);
        process.exit(1);
    }
} else {
    const config = {};
    for (const [clave, variable] of Object.entries(VARIABLES)) {
        const v = valor(variable);
        if (v) config[clave] = v;
    }

    const demo = valor('CONFIG_SHOW_DEMO_ACCOUNTS').toLowerCase();
    if (demo === 'true' || demo === 'false') {
        config.showDemoAccounts = demo === 'true';
    }

    if (Object.keys(config).length > 0) {
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.warn(
                '⚠️  config.json sin CONFIG_SUPABASE_URL o CONFIG_SUPABASE_ANON_KEY: ' +
                'la copia pedirá los datos en /configuracion.'
            );
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
        console.log(
            `✅ config.json creado con ${Object.keys(config).length} valores` +
            (config.appName ? ` para "${config.appName}"` : '')
        );
    } else {
        console.log('ℹ️  Sin variables CONFIG_*: no se genera config.json (modo demo).');
    }
}
