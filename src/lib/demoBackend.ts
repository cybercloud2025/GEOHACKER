/**
 * Base de datos de demostración, dentro del navegador.
 *
 * Reproduce el contrato de las 28 funciones RPC del esquema real, pero sobre
 * datos en memoria. Sirve para que cualquiera pueda abrir la aplicación y
 * navegarla sin crear un proyecto de Supabase ni configurar nada.
 *
 * Se activa sola cuando no hay conexión configurada. En cuanto se introduce una
 * URL de Supabase válida, `rpc()` deja de pasar por aquí y habla con la base de
 * datos real.
 *
 * Reglas de aislamiento y de permisos replicadas del esquema: un administrador
 * solo ve a sus empleados, el maestro valida altas, el PIN decide el rol. Si
 * cambian allí, hay que cambiarlas aquí.
 */

const ALMACEN = 'geohacker-demo-db';

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

export interface EmpleadoDemo {
    id: string;
    first_name: string;
    last_name: string;
    pin_text: string;
    role: 'admin' | 'employee';
    verified: boolean;
    is_master: boolean;
    employee_email: string | null;
    avatar_url: string | null;
    invite_code: string | null;
    admin_id: string | null;
    company_name: string | null;
    fiscal_id: string | null;
    is_active: boolean;
    created_at: string;
}

interface Coordenada { lat: number; lng: number; accuracy?: number }

interface FichajeDemo {
    id: string;
    employee_id: string;
    start_time: string;
    end_time: string | null;
    status: 'active' | 'completed' | 'break';
    start_location: Coordenada | null;
    end_location: Coordenada | null;
    notes: string | null;
}

interface PausaDemo {
    id: string;
    time_entry_id: string;
    start_time: string;
    end_time: string | null;
    reason: string | null;
}

interface PuntoDemo {
    id: string;
    employee_id: string;
    time_entry_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    battery_level: number | null;
    timestamp: string;
}

interface BaseDemo {
    empleados: EmpleadoDemo[];
    fichajes: FichajeDemo[];
    pausas: PausaDemo[];
    puntos: PuntoDemo[];
    sesiones: Record<string, string>; // token -> id de empleado
    ajustes: { registrations_enabled: boolean };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const uuid = (): string =>
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

const ahora = () => new Date().toISOString();
const menos = (ms: number) => new Date(Date.now() - ms).toISOString();
const HORA = 3600_000;
const DIA = 24 * HORA;

const azar = (min: number, max: number) => min + Math.random() * (max - min);

class ErrorDemo extends Error {}
const fallo = (mensaje: string): never => { throw new ErrorDemo(mensaje); };

// ---------------------------------------------------------------------------
// Generación del mundo de demostración
// ---------------------------------------------------------------------------

/** Mismas cuentas que db/demo_seed.sql, para que el panel de acceso cuadre. */
function sembrar(): BaseDemo {
    const nuevo = (
        first_name: string, last_name: string, pin_text: string,
        role: 'admin' | 'employee', extra: Partial<EmpleadoDemo> = {}
    ): EmpleadoDemo => ({
        id: uuid(),
        first_name, last_name, pin_text, role,
        verified: true,
        is_master: false,
        employee_email: `${first_name.toLowerCase()}.${last_name.toLowerCase()}@demo.example.com`,
        avatar_url: null,
        invite_code: null,
        admin_id: null,
        company_name: null,
        fiscal_id: null,
        is_active: true,
        created_at: menos(120 * DIA),
        ...extra,
    });

    const maestra = nuevo('MARTA', 'NAVARRO', '99999999', 'admin', {
        is_master: true, invite_code: 'CORP-DEMO',
        company_name: 'GEOHACKER Central', fiscal_id: 'B00000000',
        employee_email: 'maestro@demo.example.com',
    });

    const laura = nuevo('LAURA', 'VEGA', '@10001', 'admin', {
        invite_code: 'CORP-NRT1', company_name: 'Logística Norte S.L.', fiscal_id: 'B11111111',
    });

    const marcos = nuevo('MARCOS', 'RUIZ', '@10002', 'admin', {
        invite_code: 'CORP-SUR2', company_name: 'Servicios Sur S.A.', fiscal_id: 'A22222222',
    });

    // Administrador pendiente de validar: enseña ese flujo del maestro.
    const elena = nuevo('ELENA', 'SOTO', '@10003', 'admin', {
        verified: false, invite_code: 'CORP-EST3',
        company_name: 'Transportes Este S.L.', fiscal_id: 'B33333333',
        created_at: menos(2 * DIA),
    });

    const empleados = [
        nuevo('ANA', 'TORRES', '1001', 'employee', { admin_id: laura.id }),
        nuevo('DAVID', 'MORA', '1002', 'employee', { admin_id: laura.id }),
        nuevo('SOFIA', 'LEON', '1003', 'employee', { admin_id: laura.id }),
        nuevo('HUGO', 'PRIETO', '2001', 'employee', { admin_id: marcos.id }),
        nuevo('CARMEN', 'GIL', '2002', 'employee', { admin_id: marcos.id }),
        // Alta sin asignar: el maestro la coloca desde "Validar y Asignar".
        nuevo('IVAN', 'RAMOS', '3001', 'employee', {
            verified: false, admin_id: null, created_at: menos(6 * HORA),
        }),
    ];

    const base: BaseDemo = {
        empleados: [maestra, laura, marcos, elena, ...empleados],
        fichajes: [], pausas: [], puntos: [],
        sesiones: {},
        ajustes: { registrations_enabled: true },
    };

    const zona = (pin: string) =>
        pin.startsWith('1') ? { lat: 40.4168, lng: -3.7038 } : { lat: 37.3891, lng: -5.9845 };

    const motivos = ['Comida', 'Descanso', 'Café', 'Gestión personal'];

    // Seis jornadas cerradas por empleado verificado.
    for (const emp of empleados.filter((e) => e.verified)) {
        const centro = zona(emp.pin_text);

        for (let dia = 1; dia <= 6; dia++) {
            const inicio = new Date(Date.now() - dia * DIA);
            inicio.setHours(8, Math.floor(azar(0, 25)), 0, 0);
            const fin = new Date(inicio.getTime() + 8 * HORA + azar(0, 50) * 60_000);

            const desde = { lat: centro.lat + azar(-0.02, 0.02), lng: centro.lng + azar(-0.02, 0.02) };
            const hasta = { lat: desde.lat + azar(-0.025, 0.025), lng: desde.lng + azar(-0.025, 0.025) };

            const fichaje: FichajeDemo = {
                id: uuid(), employee_id: emp.id,
                start_time: inicio.toISOString(), end_time: fin.toISOString(),
                status: 'completed',
                start_location: { ...desde, accuracy: 8 },
                end_location: { ...hasta, accuracy: 10 },
                notes: Math.random() < 0.3 ? 'Jornada completada sin incidencias' : null,
            };
            base.fichajes.push(fichaje);

            const total = 14;
            for (let i = 0; i <= total; i++) {
                const f = i / total;
                base.puntos.push({
                    id: uuid(), employee_id: emp.id, time_entry_id: fichaje.id,
                    latitude: desde.lat + (hasta.lat - desde.lat) * f + azar(-0.0008, 0.0008),
                    longitude: desde.lng + (hasta.lng - desde.lng) * f + azar(-0.0008, 0.0008),
                    accuracy: azar(5, 17), heading: azar(0, 360), speed: azar(0, 11),
                    battery_level: Math.max(15, Math.round(100 - f * 55)),
                    timestamp: new Date(inicio.getTime() + (fin.getTime() - inicio.getTime()) * f).toISOString(),
                });
            }

            if (Math.random() < 0.75) {
                const pausaIni = new Date(inicio.getTime() + 4 * HORA + azar(0, 40) * 60_000);
                base.pausas.push({
                    id: uuid(), time_entry_id: fichaje.id,
                    start_time: pausaIni.toISOString(),
                    end_time: new Date(pausaIni.getTime() + azar(20, 60) * 60_000).toISOString(),
                    reason: motivos[Math.floor(Math.random() * motivos.length)],
                });
            }
        }
    }

    // Dos turnos abiertos ahora mismo, uno por empresa, para el mapa en vivo.
    for (const pin of ['1001', '2001']) {
        const emp = empleados.find((e) => e.pin_text === pin)!;
        const centro = zona(pin);
        const inicio = new Date(Date.now() - 3 * HORA);
        const desde = { lat: centro.lat + azar(-0.01, 0.01), lng: centro.lng + azar(-0.01, 0.01) };

        const fichaje: FichajeDemo = {
            id: uuid(), employee_id: emp.id,
            start_time: inicio.toISOString(), end_time: null, status: 'active',
            start_location: { ...desde, accuracy: 7 }, end_location: null, notes: null,
        };
        base.fichajes.push(fichaje);

        const total = 10;
        for (let i = 0; i <= total; i++) {
            const f = i / total;
            base.puntos.push({
                id: uuid(), employee_id: emp.id, time_entry_id: fichaje.id,
                latitude: desde.lat + f * 0.012 + azar(-0.0005, 0.0005),
                longitude: desde.lng + f * 0.010 + azar(-0.0005, 0.0005),
                accuracy: azar(4, 13), heading: azar(0, 360), speed: azar(0, 9),
                battery_level: Math.max(20, Math.round(95 - f * 40)),
                timestamp: new Date(inicio.getTime() + (Date.now() - 60_000 - inicio.getTime()) * f).toISOString(),
            });
        }
    }

    return base;
}

// ---------------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------------

let cache: BaseDemo | null = null;

const leer = (): BaseDemo => {
    if (cache) return cache;
    try {
        const guardado = localStorage.getItem(ALMACEN);
        if (guardado) {
            const datos = JSON.parse(guardado) as BaseDemo;
            if (datos?.empleados?.length) {
                cache = datos;
                return cache;
            }
        }
    } catch {
        // Datos corruptos o almacenamiento no disponible: se regenera.
    }
    cache = sembrar();
    guardar();
    return cache;
};

const guardar = () => {
    try {
        if (cache) localStorage.setItem(ALMACEN, JSON.stringify(cache));
    } catch {
        // Modo privado o cuota llena: la demo sigue en memoria.
    }
};

/** Vuelve a generar el mundo de demostración desde cero. */
export const reiniciarDemo = () => {
    cache = sembrar();
    guardar();
};

// ---------------------------------------------------------------------------
// Sesiones y permisos
// ---------------------------------------------------------------------------

const conSesion = (token: unknown): EmpleadoDemo => {
    const db = leer();
    const id = typeof token === 'string' ? db.sesiones[token] : undefined;
    const emp = db.empleados.find((e) => e.id === id && e.is_active);
    return emp ?? fallo('SESION_INVALIDA');
};

const comoAdmin = (token: unknown): EmpleadoDemo => {
    const emp = conSesion(token);
    if (emp.role !== 'admin') fallo('PERMISO_DENEGADO');
    if (!emp.verified && !emp.is_master) fallo('CUENTA_PENDIENTE_DE_VALIDACION');
    return emp;
};

const comoMaestro = (token: unknown): EmpleadoDemo => {
    const emp = comoAdmin(token);
    if (!emp.is_master) fallo('PERMISO_DENEGADO');
    return emp;
};

const puedeGestionar = (admin: EmpleadoDemo, objetivo: EmpleadoDemo): boolean =>
    admin.is_master || (objetivo.admin_id === admin.id && objetivo.role === 'employee');

const publico = (e: EmpleadoDemo) => ({
    id: e.id, first_name: e.first_name, last_name: e.last_name,
    role: e.role, is_master: e.is_master, verified: e.verified,
    invite_code: e.invite_code, admin_id: e.admin_id,
    employee_email: e.employee_email, avatar_url: e.avatar_url,
    company_name: e.company_name, fiscal_id: e.fiscal_id,
});

const abrirSesion = (empleadoId: string): string => {
    const db = leer();
    const token = uuid() + uuid();
    db.sesiones[token] = empleadoId;
    guardar();
    return token;
};

const codigoLibre = (): string => {
    const db = leer();
    let codigo = '';
    do {
        codigo = 'CORP-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    } while (db.empleados.some((e) => e.invite_code === codigo));
    return codigo;
};

const turnoAbierto = (empleadoId: string) =>
    leer().fichajes.find((f) => f.employee_id === empleadoId && !f.end_time);

const enAlcance = (admin: EmpleadoDemo, e: EmpleadoDemo) =>
    admin.is_master || e.admin_id === admin.id;

// ---------------------------------------------------------------------------
// Implementación de las RPC
// ---------------------------------------------------------------------------

type Args = Record<string, unknown>;
const cad = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const OPERACIONES: Record<string, (a: Args) => unknown> = {

    // --- públicas ---------------------------------------------------------
    get_public_settings: () => ({ registrations_enabled: leer().ajustes.registrations_enabled }),

    login_with_pin: (a) => {
        const db = leer();
        const pin = cad(a.p_pin);
        const emp = db.empleados.find((e) => e.pin_text === pin && e.is_active);

        if (!emp) return { error: 'CREDENCIALES_INVALIDAS' };
        if (emp.role === 'admin' && !emp.verified && !emp.is_master) {
            return { error: 'CUENTA_PENDIENTE_DE_VALIDACION' };
        }
        return { ...publico(emp), token: abrirSesion(emp.id) };
    },

    register_employee: (a) => {
        const db = leer();
        if (!db.ajustes.registrations_enabled) fallo('El registro de nuevos usuarios está desactivado.');

        const pin = cad(a.p_pin);
        if (!/^\d{4}$/.test(pin)) fallo('El PIN de empleado debe tener exactamente 4 dígitos.');
        if (db.empleados.some((e) => e.pin_text === pin)) fallo('Este PIN ya está en uso por otro usuario.');

        const codigo = cad(a.p_invite_code);
        let admin: EmpleadoDemo | undefined;
        if (codigo) {
            admin = db.empleados.find(
                (e) => e.invite_code?.toUpperCase() === codigo.toUpperCase() && e.role === 'admin'
            );
            if (!admin) fallo('Código de organización inválido.');
        }

        const emp: EmpleadoDemo = {
            id: uuid(), first_name: cad(a.p_first_name), last_name: cad(a.p_last_name),
            pin_text: pin, role: 'employee', verified: false, is_master: false,
            employee_email: cad(a.p_email) || null, avatar_url: (a.p_avatar_url as string) ?? null,
            invite_code: null, admin_id: admin?.id ?? null,
            company_name: null, fiscal_id: null, is_active: true, created_at: ahora(),
        };
        db.empleados.push(emp);
        guardar();

        return { ...publico(emp), token: abrirSesion(emp.id), admin_email: admin?.employee_email ?? null };
    },

    register_admin: (a) => {
        const db = leer();
        const pin = cad(a.p_pin);
        if (!/^@\d{5}$/.test(pin)) {
            fallo('El PIN de administrador debe tener el formato @ + 5 dígitos (ej: @12345).');
        }
        if (db.empleados.some((e) => e.pin_text === pin)) fallo('Este PIN ya está en uso por otro usuario.');

        const emp: EmpleadoDemo = {
            id: uuid(), first_name: cad(a.p_first_name), last_name: cad(a.p_last_name),
            pin_text: pin, role: 'admin', verified: false, is_master: false,
            employee_email: cad(a.p_email) || null, avatar_url: (a.p_avatar_url as string) ?? null,
            invite_code: codigoLibre(), admin_id: null,
            company_name: cad(a.p_company_name) || null, fiscal_id: cad(a.p_fiscal_id) || null,
            is_active: true, created_at: ahora(),
        };
        db.empleados.push(emp);
        guardar();

        const maestro = db.empleados.find((e) => e.is_master);
        return { ...publico(emp), admin_email: maestro?.employee_email ?? null };
    },

    // --- sesión -----------------------------------------------------------
    logout: (a) => {
        const db = leer();
        const token = cad(a.p_token);
        delete db.sesiones[token];
        guardar();
        return null;
    },

    get_me: (a) => publico(conSesion(a.p_token)),

    // --- empleado ---------------------------------------------------------
    get_my_status: (a) => {
        const emp = conSesion(a.p_token);
        const turno = turnoAbierto(emp.id);
        if (!turno) return { status: 'idle' };
        const pausa = leer().pausas.find((p) => p.time_entry_id === turno.id && !p.end_time);
        return {
            status: turno.status,
            current_shift_id: turno.id,
            current_break_id: pausa?.id ?? null,
            start_time: turno.start_time,
        };
    },

    clock_in: (a) => {
        const emp = conSesion(a.p_token);
        const abierto = turnoAbierto(emp.id);
        if (abierto) return abierto.id;

        const db = leer();
        const turno: FichajeDemo = {
            id: uuid(), employee_id: emp.id, start_time: ahora(), end_time: null,
            status: 'active', start_location: (a.p_location as Coordenada) ?? null,
            end_location: null, notes: null,
        };
        db.fichajes.push(turno);
        guardar();
        return turno.id;
    },

    clock_out: (a) => {
        const emp = conSesion(a.p_token);
        const turno = turnoAbierto(emp.id);
        if (!turno) return null;

        const db = leer();
        db.pausas.filter((p) => p.time_entry_id === turno.id && !p.end_time)
            .forEach((p) => { p.end_time = ahora(); });

        turno.end_time = ahora();
        turno.status = 'completed';
        turno.end_location = (a.p_location as Coordenada) ?? null;
        turno.notes = cad(a.p_notes) || null;
        guardar();
        return null;
    },

    start_break: (a) => {
        const emp = conSesion(a.p_token);
        const turno = turnoAbierto(emp.id) ?? fallo('No hay turno activo para pausar.');

        const db = leer();
        let pausa = db.pausas.find((p) => p.time_entry_id === turno.id && !p.end_time);
        if (!pausa) {
            pausa = { id: uuid(), time_entry_id: turno.id, start_time: ahora(), end_time: null, reason: cad(a.p_reason) || null };
            db.pausas.push(pausa);
        }
        turno.status = 'break';
        guardar();
        return pausa.id;
    },

    end_break: (a) => {
        const emp = conSesion(a.p_token);
        const turno = turnoAbierto(emp.id) ?? fallo('No hay turno activo.');

        leer().pausas.filter((p) => p.time_entry_id === turno.id && !p.end_time)
            .forEach((p) => { p.end_time = ahora(); });
        turno.status = 'active';
        guardar();
        return null;
    },

    record_location: (a) => {
        const emp = conSesion(a.p_token);
        const turno = turnoAbierto(emp.id);
        if (!turno) return null;

        const db = leer();
        db.puntos.push({
            id: uuid(), employee_id: emp.id, time_entry_id: turno.id,
            latitude: Number(a.p_latitude), longitude: Number(a.p_longitude),
            accuracy: a.p_accuracy == null ? null : Number(a.p_accuracy),
            heading: a.p_heading == null ? null : Number(a.p_heading),
            speed: a.p_speed == null ? null : Number(a.p_speed),
            battery_level: a.p_battery == null ? null : Number(a.p_battery),
            timestamp: ahora(),
        });
        guardar();
        return null;
    },

    // --- administración: lectura -----------------------------------------
    admin_list_users: (a) => {
        const admin = comoAdmin(a.p_token);
        return leer().empleados
            .filter((e) => e.role !== 'admin' && (e.admin_id === admin.id || (admin.is_master && !e.verified)))
            .sort((x, y) => y.created_at.localeCompare(x.created_at));
    },

    admin_list_admins: (a) => {
        comoMaestro(a.p_token);
        return leer().empleados
            .filter((e) => e.role === 'admin')
            .sort((x, y) => y.created_at.localeCompare(x.created_at));
    },

    admin_list_assignable_admins: (a) => {
        comoMaestro(a.p_token);
        return leer().empleados
            .filter((e) => e.role === 'admin' && !e.is_master && e.is_active)
            .sort((x, y) => x.first_name.localeCompare(y.first_name))
            .map((e) => ({
                id: e.id, first_name: e.first_name, last_name: e.last_name,
                employee_email: e.employee_email, invite_code: e.invite_code,
                company_name: e.company_name,
            }));
    },

    admin_get_history: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();

        return db.fichajes
            .map((f) => ({ f, e: db.empleados.find((x) => x.id === f.employee_id) }))
            .filter(({ e }) => e && e.role !== 'admin' && enAlcance(admin, e))
            .sort((x, y) => y.f.start_time.localeCompare(x.f.start_time))
            .map(({ f, e }) => {
                const pausas = db.pausas.filter((p) => p.time_entry_id === f.id);
                const horas = pausas.reduce((t, p) => t + (p.end_time
                    ? new Date(p.end_time).getTime() - new Date(p.start_time).getTime() : 0), 0) / HORA;
                return {
                    id: f.id,
                    employee_id: e!.id,
                    employee_name: `${e!.first_name} ${e!.last_name}`,
                    employee_role: e!.role,
                    start_time: f.start_time, end_time: f.end_time, status: f.status,
                    start_location: f.start_location, end_location: f.end_location,
                    breaks_count: pausas.length,
                    total_break_duration: { hours: horas },
                };
            });
    },

    admin_get_time_entry: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();
        const f = db.fichajes.find((x) => x.id === cad(a.p_entry_id));
        const e = f && db.empleados.find((x) => x.id === f.employee_id);
        if (!f || !e || !enAlcance(admin, e)) fallo('PERMISO_DENEGADO');
        return {
            id: f!.id, employee_name: `${e!.first_name} ${e!.last_name}`,
            start_time: f!.start_time, end_time: f!.end_time, status: f!.status,
            start_location: f!.start_location, end_location: f!.end_location,
        };
    },

    admin_get_active_user_ids: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();
        return [...new Set(db.fichajes.filter((f) => !f.end_time).map((f) => f.employee_id))]
            .filter((id) => {
                const e = db.empleados.find((x) => x.id === id);
                return e && enAlcance(admin, e);
            });
    },

    admin_get_live_locations: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();

        return db.fichajes
            .filter((f) => !f.end_time)
            .map((f) => ({ f, e: db.empleados.find((x) => x.id === f.employee_id) }))
            .filter(({ e }) => e && e.role !== 'admin' && enAlcance(admin, e))
            .map(({ f, e }) => {
                const ultimo = db.puntos
                    .filter((p) => p.time_entry_id === f.id)
                    .sort((x, y) => y.timestamp.localeCompare(x.timestamp))[0];
                return {
                    employee_id: e!.id,
                    first_name: e!.first_name, last_name: e!.last_name, avatar_url: e!.avatar_url,
                    latitude: ultimo?.latitude ?? 0, longitude: ultimo?.longitude ?? 0,
                    accuracy: ultimo?.accuracy ?? 0, heading: ultimo?.heading ?? null,
                    speed: ultimo?.speed ?? null, battery_level: ultimo?.battery_level ?? null,
                    last_ping: ultimo?.timestamp ?? f.start_time,
                    shift_start_time: f.start_time, status: f.status,
                    has_gps: Boolean(ultimo),
                };
            });
    },

    // --- administración: escritura ---------------------------------------
    admin_create_user: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();
        const pin = cad(a.p_pin);

        if (!/^\d{4}$/.test(pin)) fallo('El PIN debe tener 4 dígitos.');
        if (db.empleados.some((e) => e.pin_text === pin)) fallo('Este PIN ya está en uso por otro usuario.');

        const emp: EmpleadoDemo = {
            id: uuid(), first_name: cad(a.p_first_name), last_name: cad(a.p_last_name),
            pin_text: pin, role: 'employee', verified: true, is_master: false,
            employee_email: cad(a.p_email) || null, avatar_url: (a.p_avatar_url as string) ?? null,
            invite_code: null, admin_id: admin.id, company_name: null, fiscal_id: null,
            is_active: true, created_at: ahora(),
        };
        db.empleados.push(emp);
        guardar();
        return { ...publico(emp), invite_code: admin.invite_code };
    },

    admin_update_employee: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();
        const emp = db.empleados.find((e) => e.id === cad(a.p_id)) ?? fallo('Usuario no encontrado.');
        if (!puedeGestionar(admin, emp)) fallo('PERMISO_DENEGADO');

        const pin = cad(a.p_pin);
        if (pin) {
            const valido = emp.is_master
                ? /^\d{4}$/.test(pin) || /^\d{8}$/.test(pin) || /^@\d{5}$/.test(pin)
                : emp.role === 'admin' || pin.startsWith('@')
                    ? /^@\d{5}$/.test(pin)
                    : /^\d{4}$/.test(pin);
            if (!valido) fallo('El formato del PIN no es válido para este usuario.');
            if (db.empleados.some((e) => e.pin_text === pin && e.id !== emp.id)) {
                fallo('Este PIN ya está en uso por otro usuario.');
            }
            emp.pin_text = pin;
            // Cambiar el PIN cierra las sesiones abiertas, como en el esquema.
            Object.keys(db.sesiones).forEach((t) => { if (db.sesiones[t] === emp.id) delete db.sesiones[t]; });
        }

        emp.first_name = cad(a.p_first_name) || emp.first_name;
        emp.last_name = cad(a.p_last_name) || emp.last_name;
        emp.employee_email = cad(a.p_email) || null;
        emp.company_name = cad(a.p_company_name) || null;
        emp.fiscal_id = cad(a.p_fiscal_id) || null;
        guardar();
        return publico(emp);
    },

    admin_verify_employee: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();
        const emp = db.empleados.find((e) => e.id === cad(a.p_id)) ?? fallo('Usuario no encontrado.');

        if (emp.role === 'admin' && !admin.is_master) fallo('PERMISO_DENEGADO');
        if (emp.role !== 'admin' && !puedeGestionar(admin, emp)) fallo('PERMISO_DENEGADO');

        emp.verified = true;
        if (emp.role === 'admin' && (!emp.invite_code || emp.invite_code.includes('?'))) {
            emp.invite_code = codigoLibre();
        }
        guardar();
        return publico(emp);
    },

    admin_assign_employee: (a) => {
        comoMaestro(a.p_token);
        const db = leer();
        const destino = db.empleados.find((e) => e.id === cad(a.p_admin_id) && e.role === 'admin');
        if (!destino) fallo('El destino no es un administrador válido.');

        const emp = db.empleados.find((e) => e.id === cad(a.p_id) && e.role !== 'admin')
            ?? fallo('Usuario no encontrado.');
        emp.admin_id = destino!.id;
        emp.verified = true;
        guardar();
        return publico(emp);
    },

    admin_set_role: (a) => {
        const maestro = comoMaestro(a.p_token);
        const db = leer();
        const rol = cad(a.p_role);
        if (rol !== 'admin' && rol !== 'employee') fallo('Rol no válido.');
        const rolValido = rol as 'admin' | 'employee';

        const emp = db.empleados.find((e) => e.id === cad(a.p_id)) ?? fallo('Usuario no encontrado.');
        if (emp.id === maestro.id) fallo('No puedes cambiar tu propio rol.');
        if (emp.is_master) fallo('No se puede degradar al Administrador Maestro.');

        emp.role = rolValido;
        if (rolValido === 'admin' && !emp.invite_code) emp.invite_code = codigoLibre();
        Object.keys(db.sesiones).forEach((t) => { if (db.sesiones[t] === emp.id) delete db.sesiones[t]; });
        guardar();
        return publico(emp);
    },

    admin_delete_employee: (a) => {
        const admin = comoAdmin(a.p_token);
        const db = leer();
        const emp = db.empleados.find((e) => e.id === cad(a.p_id));
        if (!emp) return null;

        if (emp.is_master) fallo('No se puede eliminar al Administrador Maestro.');
        if (emp.id === admin.id) fallo('No puedes eliminarte a ti mismo.');
        if (emp.role === 'admin' && !admin.is_master) fallo('PERMISO_DENEGADO');
        if (emp.role !== 'admin' && !puedeGestionar(admin, emp)) fallo('PERMISO_DENEGADO');

        const turnos = db.fichajes.filter((f) => f.employee_id === emp.id).map((f) => f.id);
        db.empleados = db.empleados.filter((e) => e.id !== emp.id);
        db.fichajes = db.fichajes.filter((f) => f.employee_id !== emp.id);
        db.puntos = db.puntos.filter((p) => p.employee_id !== emp.id);
        db.pausas = db.pausas.filter((p) => !turnos.includes(p.time_entry_id));
        guardar();
        return null;
    },

    admin_set_registration_enabled: (a) => {
        comoMaestro(a.p_token);
        leer().ajustes.registrations_enabled = a.p_enabled === true;
        guardar();
        return null;
    },

    admin_impersonate: (a) => {
        comoMaestro(a.p_token);
        const destino = leer().empleados.find((e) => e.id === cad(a.p_target_id) && e.is_active)
            ?? fallo('Usuario no encontrado.');
        return { ...publico(destino!), token: abrirSesion(destino!.id) };
    },

    admin_regenerate_invite_code: (a) => {
        comoMaestro(a.p_token);
        const emp = leer().empleados.find((e) => e.id === cad(a.p_id) && e.role === 'admin')
            ?? fallo('Administrador no encontrado.');
        emp!.invite_code = codigoLibre();
        guardar();
        return publico(emp!);
    },
};

/** ¿Está implementada esta función en la base de datos de demostración? */
export const demoSoporta = (fn: string): boolean => fn in OPERACIONES;

/** Ejecuta una RPC contra los datos de demostración. */
export const ejecutarDemo = async <T>(fn: string, args: Args): Promise<T> => {
    const operacion = OPERACIONES[fn];
    if (!operacion) throw new Error(`La demostración no implementa "${fn}".`);

    // Un pequeño retardo evita que la interfaz parezca instantánea de un modo
    // que no se corresponde con la aplicación real.
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));

    return operacion(args) as T;
};
