/**
 * Banco de pruebas del backend de demostración.
 *
 * Ejecuta los flujos reales de la aplicación contra la base ficticia y
 * comprueba, sobre todo, que el aislamiento entre empresas se respeta.
 */

// --- entorno de navegador mínimo -------------------------------------------
const almacen = new Map();
globalThis.localStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k),
};

// Lo transpila `npm run test:demo` antes de llegar aquí.
const { ejecutarDemo, reiniciarDemo } = await import('../node_modules/.tmp/demoBackend.mjs');

let ok = 0;
let mal = 0;
const comprobar = (titulo, condicion, detalle = '') => {
    if (condicion) { ok++; console.log(`  ✅ ${titulo}`); }
    else { mal++; console.log(`  ❌ ${titulo}${detalle ? ' — ' + detalle : ''}`); }
};

const rpc = (fn, args = {}) => ejecutarDemo(fn, args);

console.log('\n=== 1. Ajustes públicos ===');
const ajustes = await rpc('get_public_settings');
comprobar('registrations_enabled llega', ajustes.registrations_enabled === true);

console.log('\n=== 2. Acceso ===');
const malo = await rpc('login_with_pin', { p_pin: '0000' });
comprobar('PIN inexistente devuelve error', malo.error === 'CREDENCIALES_INVALIDAS');

const pendiente = await rpc('login_with_pin', { p_pin: '@10003' });
comprobar('admin sin validar no entra', pendiente.error === 'CUENTA_PENDIENTE_DE_VALIDACION');

const maestra = await rpc('login_with_pin', { p_pin: '99999999' });
comprobar('maestra entra', Boolean(maestra.token), JSON.stringify(maestra).slice(0, 80));
comprobar('maestra marcada is_master', maestra.is_master === true);

const laura = await rpc('login_with_pin', { p_pin: '@10001' });
const marcos = await rpc('login_with_pin', { p_pin: '@10002' });
const ana = await rpc('login_with_pin', { p_pin: '1001' });
const david = await rpc('login_with_pin', { p_pin: '1002' });
comprobar('los tres administradores y empleados entran',
    Boolean(laura.token && marcos.token && ana.token && david.token));

console.log('\n=== 3. AISLAMIENTO ENTRE EMPRESAS ===');
const usuariosLaura = await rpc('admin_list_users', { p_token: laura.token });
const usuariosMarcos = await rpc('admin_list_users', { p_token: marcos.token });
comprobar('Laura ve 3 empleados', usuariosLaura.length === 3, `ve ${usuariosLaura.length}`);
comprobar('Marcos ve 2 empleados', usuariosMarcos.length === 2, `ve ${usuariosMarcos.length}`);

const idsLaura = new Set(usuariosLaura.map((u) => u.id));
const solapan = usuariosMarcos.filter((u) => idsLaura.has(u.id));
comprobar('no comparten ni un empleado', solapan.length === 0, `${solapan.length} solapados`);

const histLaura = await rpc('admin_get_history', { p_token: laura.token });
const nombresLaura = new Set(histLaura.map((h) => h.employee_name));
comprobar('el historial de Laura solo tiene a los suyos',
    [...nombresLaura].every((n) => usuariosLaura.some((u) => `${u.first_name} ${u.last_name}` === n)),
    [...nombresLaura].join(', '));

console.log('\n=== 4. Permisos ===');
let denegado = false;
try { await rpc('admin_list_admins', { p_token: laura.token }); }
catch (e) { denegado = e.message.includes('PERMISO_DENEGADO'); }
comprobar('un admin normal NO puede listar administradores', denegado);

const admins = await rpc('admin_list_admins', { p_token: maestra.token });
comprobar('la maestra sí puede', Array.isArray(admins) && admins.length === 4, `${admins.length} admins`);

denegado = false;
try { await rpc('admin_list_users', { p_token: ana.token }); }
catch (e) { denegado = e.message.includes('PERMISO_DENEGADO'); }
comprobar('un empleado NO puede entrar al panel', denegado);

denegado = false;
try { await rpc('admin_list_users', { p_token: 'token-inventado' }); }
catch (e) { denegado = e.message.includes('SESION_INVALIDA'); }
comprobar('un token falso es rechazado', denegado);

console.log('\n=== 5. Fichaje de un empleado ===');
const estadoAna = await rpc('get_my_status', { p_token: ana.token });
comprobar('Ana tiene turno abierto (sembrado)', estadoAna.status === 'active', estadoAna.status);

const estadoDavid = await rpc('get_my_status', { p_token: david.token });
comprobar('David está libre', estadoDavid.status === 'idle', estadoDavid.status);

const turno = await rpc('clock_in', { p_token: david.token, p_location: { lat: 40.4, lng: -3.7 } });
comprobar('David ficha entrada', typeof turno === 'string' && turno.length > 0);

const repetido = await rpc('clock_in', { p_token: david.token });
comprobar('fichar dos veces devuelve el mismo turno', repetido === turno);

await rpc('record_location', { p_token: david.token, p_latitude: 40.41, p_longitude: -3.71, p_battery: 77 });
const pausa = await rpc('start_break', { p_token: david.token, p_reason: 'Café' });
comprobar('inicia pausa', typeof pausa === 'string');
comprobar('el estado pasa a pausa', (await rpc('get_my_status', { p_token: david.token })).status === 'break');

await rpc('end_break', { p_token: david.token });
comprobar('vuelve de la pausa', (await rpc('get_my_status', { p_token: david.token })).status === 'active');

await rpc('clock_out', { p_token: david.token, p_notes: 'Prueba' });
comprobar('ficha salida', (await rpc('get_my_status', { p_token: david.token })).status === 'idle');

console.log('\n=== 6. Mapa en vivo ===');
const vivoLaura = await rpc('admin_get_live_locations', { p_token: laura.token });
const vivoMarcos = await rpc('admin_get_live_locations', { p_token: marcos.token });
comprobar('Laura ve 1 empleado en la calle', vivoLaura.length === 1, `${vivoLaura.length}`);
comprobar('Marcos ve 1 empleado en la calle', vivoMarcos.length === 1, `${vivoMarcos.length}`);
comprobar('con coordenadas reales',
    vivoLaura[0]?.has_gps === true && Math.abs(vivoLaura[0].latitude) > 1,
    JSON.stringify(vivoLaura[0]?.latitude));

console.log('\n=== 7. Gestión desde el panel ===');
const creado = await rpc('admin_create_user', {
    p_token: laura.token, p_first_name: 'NUEVO', p_last_name: 'EMPLEADO', p_pin: '4321',
});
comprobar('Laura crea un empleado', Boolean(creado.id));
comprobar('ahora ve 4', (await rpc('admin_list_users', { p_token: laura.token })).length === 4);
comprobar('Marcos sigue viendo 2',
    (await rpc('admin_list_users', { p_token: marcos.token })).length === 2);

denegado = false;
try { await rpc('admin_delete_employee', { p_token: marcos.token, p_id: creado.id }); }
catch (e) { denegado = e.message.includes('PERMISO_DENEGADO'); }
comprobar('Marcos NO puede borrar a un empleado de Laura', denegado);

await rpc('admin_delete_employee', { p_token: laura.token, p_id: creado.id });
comprobar('Laura sí puede borrarlo',
    (await rpc('admin_list_users', { p_token: laura.token })).length === 3);

console.log('\n=== 8. Flujos del maestro ===');
const sinAsignar = (await rpc('admin_list_users', { p_token: maestra.token }))
    .filter((u) => !u.admin_id && !u.verified);
comprobar('la maestra ve el alta sin asignar', sinAsignar.length === 1, `${sinAsignar.length}`);

await rpc('admin_assign_employee', {
    p_token: maestra.token, p_id: sinAsignar[0].id, p_admin_id: marcos.id,
});
comprobar('tras asignarlo, Marcos ve 3',
    (await rpc('admin_list_users', { p_token: marcos.token })).length === 3);

const elena = admins.find((a) => a.pin_text === '@10003');
await rpc('admin_verify_employee', { p_token: maestra.token, p_id: elena.id });
const elenaEntra = await rpc('login_with_pin', { p_pin: '@10003' });
comprobar('validada, Elena ya puede entrar', Boolean(elenaEntra.token));

const suplantada = await rpc('admin_impersonate', { p_token: maestra.token, p_target_id: laura.id });
comprobar('la maestra suplanta a Laura', Boolean(suplantada.token) && suplantada.token !== laura.token);
comprobar('y con ese token ve los usuarios de Laura',
    (await rpc('admin_list_users', { p_token: suplantada.token })).length === 3);

console.log('\n=== 9. Alta pública ===');
const alta = await rpc('register_employee', {
    p_first_name: 'PABLO', p_last_name: 'DIAZ', p_pin: '7777', p_invite_code: 'CORP-NRT1',
});
comprobar('se registra con el código de Laura', Boolean(alta.token));
comprobar('queda sin validar', alta.verified === false);
comprobar('Laura lo ve en su lista',
    (await rpc('admin_list_users', { p_token: laura.token })).some((u) => u.pin_text === '7777'));

let rechazado = false;
try { await rpc('register_employee', { p_first_name: 'X', p_last_name: 'Y', p_pin: '7777' }); }
catch (e) { rechazado = e.message.includes('ya está en uso'); }
comprobar('un PIN duplicado se rechaza', rechazado);

rechazado = false;
try { await rpc('register_employee', { p_first_name: 'X', p_last_name: 'Y', p_pin: '12' }); }
catch (e) { rechazado = e.message.includes('4 dígitos'); }
comprobar('un PIN de 2 dígitos se rechaza', rechazado);

console.log('\n=== 10. Reinicio ===');
reiniciarDemo();
comprobar('vuelve al estado inicial',
    (await rpc('admin_list_users', { p_token: (await rpc('login_with_pin', { p_pin: '@10001' })).token })).length === 3);

console.log(`\n${'='.repeat(50)}`);
console.log(`  ${ok} correctas, ${mal} fallidas`);
console.log('='.repeat(50));
process.exit(mal > 0 ? 1 : 0);
