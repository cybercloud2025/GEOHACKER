/**
 * Genera db/demo_full.sql uniendo el esquema y los datos de demostración.
 *
 * Existe para que montar una base de datos de demo sea un único pegado en el
 * editor SQL de Supabase, en lugar de dos ficheros en el orden correcto. Se
 * genera en vez de mantenerse a mano para que no se desincronice de sus
 * fuentes: si tocas schema.sql o demo_seed.sql, vuelve a ejecutar
 * `npm run db:demo`.
 */
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const fuentes = ['db/schema.sql', 'db/demo_seed.sql'];
const destino = path.join(raiz, 'db/demo_full.sql');

const cabecera = `-- ============================================================================
-- GEOHACKER — INSTALACIÓN COMPLETA DE LA DEMO (fichero generado)
-- ============================================================================
-- No edites este fichero: se genera con \`npm run db:demo\` a partir de
--   ${fuentes.join('\n--   ')}
-- Edita esas fuentes y vuelve a generarlo.
--
-- USO
--   1. Crea un proyecto de Supabase NUEVO Y EXCLUSIVO para la demo.
--      Los datos de prueba no deben convivir con datos reales.
--   2. Pega este fichero entero en su SQL Editor y ejecútalo.
--   3. Copia la URL del proyecto y su clave anónima en /configuracion.
--
-- Al terminar verás en los mensajes el resumen de la instalación y la lista
-- de cuentas con las que entrar.
-- ============================================================================

`;

const partes = fuentes.map((rel) => {
    const contenido = fs.readFileSync(path.join(raiz, rel), 'utf8');
    const separador =
        `\n\n-- ${'='.repeat(74)}\n` +
        `-- INICIO DE ${rel}\n` +
        `-- ${'='.repeat(74)}\n\n`;
    return separador + contenido;
});

fs.writeFileSync(destino, cabecera + partes.join('\n'), 'utf8');

const lineas = fs.readFileSync(destino, 'utf8').split('\n').length;
console.log(`db/demo_full.sql generado: ${lineas} líneas a partir de ${fuentes.length} ficheros.`);
