import fs from 'fs';
import path from 'path';

/**
 * Ajustes posteriores al build.
 *
 * 1. 404.html — GitHub Pages lo sirve cuando la ruta no existe como fichero.
 *    Al ser una copia de index.html, el enrutado del navegador sigue
 *    funcionando al recargar en /admin o /configuracion.
 *
 * 2. CNAME — el dominio propio, si lo hay. NO está en el código: llega por la
 *    variable de entorno PAGES_CNAME. Así el repositorio no queda atado a
 *    ningún dominio concreto y cualquiera puede desplegar su propia copia sin
 *    heredar el de otro.
 */

const distDir = path.resolve('dist');
const indexFile = path.join(distDir, 'index.html');
const notFoundFile = path.join(distDir, '404.html');
const cnameFile = path.join(distDir, 'CNAME');

if (!fs.existsSync(indexFile)) {
    console.error('❌ No existe dist/index.html. El build ha fallado.');
    process.exit(1);
}

try {
    fs.copyFileSync(indexFile, notFoundFile);
    console.log('✅ 404.html creado a partir de index.html');
} catch (error) {
    console.error('❌ Error al crear 404.html:', error);
    process.exit(1);
}

const dominio = (process.env.PAGES_CNAME || '').trim();

if (dominio) {
    fs.writeFileSync(cnameFile, `${dominio}\n`, 'utf8');
    console.log(`✅ CNAME creado para ${dominio}`);
} else {
    console.log('ℹ️  Sin PAGES_CNAME: no se genera CNAME (el sitio se servirá en la URL por defecto).');
}
