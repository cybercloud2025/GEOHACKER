-- ============================================================================
-- GEOHACKER — DATOS DE DEMOSTRACIÓN
-- ============================================================================
-- Crea un mundo de demo completo: un Administrador Maestro, dos empresas con
-- sus administradores y empleados, una empresa pendiente de validar, historial
-- de fichajes de los últimos días, pausas, rutas GPS y dos turnos abiertos
-- ahora mismo para que el mapa en vivo tenga contenido.
--
-- REQUISITO: ejecutar antes db/schema.sql.
--
-- Es idempotente: vuelve a generar el mundo de demo desde cero en cada
-- ejecución. Todas las cuentas usan el dominio @demo.geohacker.app, que es lo
-- que permite borrarlas sin tocar datos reales (ver db/demo_reset.sql).
--
-- ⚠️  NO lo ejecutes en la base de datos de producción.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LIMPIEZA DE UNA EJECUCIÓN ANTERIOR
-- ---------------------------------------------------------------------------
-- El borrado en cascada se lleva por delante fichajes, pausas y ubicaciones.
DELETE FROM employees WHERE employee_email LIKE '%@demo.geohacker.app';

-- ---------------------------------------------------------------------------
-- 2. CUENTAS
-- ---------------------------------------------------------------------------
-- pin_hash se rellena con un valor de relleno a propósito: el trigger
-- trg_hash_pin lo sustituye por el bcrypt real de pin_text.

-- 2.1 Administrador Maestro
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, is_master,
     employee_email, invite_code, company_name, fiscal_id)
VALUES
    ('JOSE', 'MAESTRO', '99999999', 'x', 'admin', true, true,
     'maestro@demo.geohacker.app', 'CORP-DEMO', 'GEOHACKER Central', 'B00000000');

-- 2.2 Administradores de empresa (validados)
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, is_master,
     employee_email, invite_code, company_name, fiscal_id)
VALUES
    ('LAURA', 'VEGA', '@10001', 'x', 'admin', true, false,
     'laura.vega@demo.geohacker.app', 'CORP-NRT1', 'Logística Norte S.L.', 'B11111111'),
    ('MARCOS', 'RUIZ', '@10002', 'x', 'admin', true, false,
     'marcos.ruiz@demo.geohacker.app', 'CORP-SUR2', 'Servicios Sur S.A.', 'A22222222');

-- 2.3 Administrador pendiente de validación (para probar ese flujo)
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, is_master,
     employee_email, invite_code, company_name, fiscal_id)
VALUES
    ('ELENA', 'SOTO', '@10003', 'x', 'admin', false, false,
     'elena.soto@demo.geohacker.app', 'CORP-EST3', 'Transportes Este S.L.', 'B33333333');

-- 2.4 Empleados de Logística Norte
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, employee_email, admin_id)
VALUES
    ('ANA',   'TORRES', '1001', 'x', 'employee', true, 'ana.torres@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10001')),
    ('DAVID', 'MORA',   '1002', 'x', 'employee', true, 'david.mora@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10001')),
    ('SOFIA', 'LEON',   '1003', 'x', 'employee', true, 'sofia.leon@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10001'));

-- 2.5 Empleados de Servicios Sur
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, employee_email, admin_id)
VALUES
    ('HUGO',   'PRIETO', '2001', 'x', 'employee', true, 'hugo.prieto@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10002')),
    ('CARMEN', 'GIL',    '2002', 'x', 'employee', true, 'carmen.gil@demo.geohacker.app',
     (SELECT id FROM employees WHERE pin_text = '@10002'));

-- 2.6 Alta sin asignar (para probar "Validar y Asignar Usuario" del Maestro)
INSERT INTO employees
    (first_name, last_name, pin_text, pin_hash, role, verified, employee_email, admin_id)
VALUES
    ('IVAN', 'RAMOS', '3001', 'x', 'employee', false, 'ivan.ramos@demo.geohacker.app', NULL);

-- ---------------------------------------------------------------------------
-- 3. HISTORIAL DE FICHAJES, PAUSAS Y RUTAS GPS
-- ---------------------------------------------------------------------------
DO $demo$
DECLARE
    v_emp        RECORD;
    v_dia        INTEGER;
    v_entrada    TIMESTAMPTZ;
    v_salida     TIMESTAMPTZ;
    v_shift      UUID;
    v_lat        DOUBLE PRECISION;
    v_lng        DOUBLE PRECISION;
    v_lat_fin    DOUBLE PRECISION;
    v_lng_fin    DOUBLE PRECISION;
    v_punto      INTEGER;
    v_puntos     INTEGER := 14;
    v_f          DOUBLE PRECISION;
    v_pausa_ini  TIMESTAMPTZ;
    v_motivos    TEXT[] := ARRAY['Comida', 'Descanso', 'Café', 'Gestión personal'];
BEGIN
    FOR v_emp IN
        SELECT e.id,
               e.pin_text,
               -- Cada empresa opera en una zona distinta para que el mapa se vea.
               CASE WHEN e.pin_text LIKE '1%' THEN 40.4168 ELSE 37.3891 END AS lat_base,
               CASE WHEN e.pin_text LIKE '1%' THEN -3.7038 ELSE -5.9845 END AS lng_base
        FROM employees e
        WHERE e.employee_email LIKE '%@demo.geohacker.app'
          AND e.role = 'employee'
          AND e.verified = true
        ORDER BY e.pin_text
    LOOP
        -- Seis jornadas cerradas, de anteayer hacia atrás.
        FOR v_dia IN 1..6 LOOP
            v_entrada := date_trunc('day', now()) - (v_dia || ' days')::INTERVAL
                         + INTERVAL '8 hours'
                         + (floor(random() * 25)::INTEGER || ' minutes')::INTERVAL;
            v_salida  := v_entrada + INTERVAL '8 hours'
                         + (floor(random() * 50)::INTEGER || ' minutes')::INTERVAL;

            -- Punto de salida y destino de la jornada (recorrido corto por ciudad).
            v_lat     := v_emp.lat_base + (random() - 0.5) * 0.04;
            v_lng     := v_emp.lng_base + (random() - 0.5) * 0.04;
            v_lat_fin := v_lat + (random() - 0.5) * 0.05;
            v_lng_fin := v_lng + (random() - 0.5) * 0.05;

            INSERT INTO time_entries
                (employee_id, start_time, end_time, status, start_location, end_location, notes)
            VALUES (
                v_emp.id, v_entrada, v_salida, 'completed',
                jsonb_build_object('lat', v_lat,     'lng', v_lng,     'accuracy', 8),
                jsonb_build_object('lat', v_lat_fin, 'lng', v_lng_fin, 'accuracy', 10),
                CASE WHEN random() < 0.3 THEN 'Jornada completada sin incidencias' ELSE NULL END
            )
            RETURNING id INTO v_shift;

            -- Ruta GPS: interpolación entre origen y destino con algo de ruido.
            FOR v_punto IN 0..v_puntos LOOP
                v_f := v_punto::DOUBLE PRECISION / v_puntos;
                INSERT INTO locations
                    (employee_id, time_entry_id, latitude, longitude,
                     accuracy, heading, speed, battery_level, timestamp)
                VALUES (
                    v_emp.id, v_shift,
                    v_lat + (v_lat_fin - v_lat) * v_f + (random() - 0.5) * 0.0015,
                    v_lng + (v_lng_fin - v_lng) * v_f + (random() - 0.5) * 0.0015,
                    5 + random() * 12,
                    random() * 360,
                    random() * 11,
                    greatest(15, 100 - round(v_f * 55)::INTEGER),
                    v_entrada + ((v_salida - v_entrada) * v_f)
                );
            END LOOP;

            -- Pausa a media jornada en la mayoría de los días.
            IF random() < 0.75 THEN
                v_pausa_ini := v_entrada + INTERVAL '4 hours'
                               + (floor(random() * 40)::INTEGER || ' minutes')::INTERVAL;
                INSERT INTO breaks (time_entry_id, start_time, end_time, reason)
                VALUES (
                    v_shift, v_pausa_ini,
                    v_pausa_ini + ((20 + floor(random() * 40))::INTEGER || ' minutes')::INTERVAL,
                    v_motivos[1 + floor(random() * array_length(v_motivos, 1))::INTEGER]
                );
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Historial de demo generado.';
END
$demo$;

-- ---------------------------------------------------------------------------
-- 4. TURNOS ABIERTOS AHORA MISMO (para el mapa en vivo)
-- ---------------------------------------------------------------------------
DO $vivo$
DECLARE
    v_emp     RECORD;
    v_shift   UUID;
    v_inicio  TIMESTAMPTZ;
    v_lat     DOUBLE PRECISION;
    v_lng     DOUBLE PRECISION;
    v_punto   INTEGER;
    v_puntos  INTEGER := 10;
    v_f       DOUBLE PRECISION;
BEGIN
    FOR v_emp IN
        SELECT e.id,
               e.pin_text,
               CASE WHEN e.pin_text = '1001' THEN 40.4168 ELSE 37.3891 END AS lat_base,
               CASE WHEN e.pin_text = '1001' THEN -3.7038 ELSE -5.9845 END AS lng_base
        FROM employees e
        -- ANA TORRES (Norte) y HUGO PRIETO (Sur): uno por empresa, para que
        -- cada administrador vea a alguien trabajando en su propio mapa.
        WHERE e.pin_text IN ('1001', '2001')
          AND e.employee_email LIKE '%@demo.geohacker.app'
    LOOP
        v_inicio := now() - INTERVAL '3 hours';
        v_lat := v_emp.lat_base + (random() - 0.5) * 0.02;
        v_lng := v_emp.lng_base + (random() - 0.5) * 0.02;

        INSERT INTO time_entries (employee_id, start_time, end_time, status, start_location)
        VALUES (
            v_emp.id, v_inicio, NULL, 'active',
            jsonb_build_object('lat', v_lat, 'lng', v_lng, 'accuracy', 7)
        )
        RETURNING id INTO v_shift;

        -- Rastro de las últimas 3 horas; el último punto es de hace un minuto,
        -- así el panel lo muestra como señal reciente.
        FOR v_punto IN 0..v_puntos LOOP
            v_f := v_punto::DOUBLE PRECISION / v_puntos;
            INSERT INTO locations
                (employee_id, time_entry_id, latitude, longitude,
                 accuracy, heading, speed, battery_level, timestamp)
            VALUES (
                v_emp.id, v_shift,
                v_lat + v_f * 0.012 + (random() - 0.5) * 0.001,
                v_lng + v_f * 0.010 + (random() - 0.5) * 0.001,
                4 + random() * 9,
                random() * 360,
                random() * 9,
                greatest(20, 95 - round(v_f * 40)::INTEGER),
                v_inicio + ((now() - INTERVAL '1 minute' - v_inicio) * v_f)
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Turnos activos de demo creados.';
END
$vivo$;

-- ---------------------------------------------------------------------------
-- 5. AJUSTES
-- ---------------------------------------------------------------------------
-- El registro abierto permite probar el alta pública desde la demo.
INSERT INTO system_settings (key, value, updated_at)
VALUES ('registrations_enabled', 'true'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();

-- ---------------------------------------------------------------------------
-- 6. RESUMEN
-- ---------------------------------------------------------------------------
DO $resumen$
DECLARE
    v_cuentas  INTEGER;
    v_fichajes INTEGER;
    v_puntos   INTEGER;
    v_activos  INTEGER;
    v_masters  INTEGER;
BEGIN
    SELECT count(*) INTO v_cuentas FROM employees
     WHERE employee_email LIKE '%@demo.geohacker.app';

    SELECT count(*) INTO v_fichajes FROM time_entries te
      JOIN employees e ON e.id = te.employee_id
     WHERE e.employee_email LIKE '%@demo.geohacker.app';

    SELECT count(*) INTO v_puntos FROM locations l
      JOIN employees e ON e.id = l.employee_id
     WHERE e.employee_email LIKE '%@demo.geohacker.app';

    SELECT count(*) INTO v_activos FROM time_entries te
      JOIN employees e ON e.id = te.employee_id
     WHERE e.employee_email LIKE '%@demo.geohacker.app' AND te.end_time IS NULL;

    SELECT count(*) INTO v_masters FROM employees WHERE is_master;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'DEMO GEOHACKER LISTA';
    RAISE NOTICE '  Cuentas creadas .......... %', v_cuentas;
    RAISE NOTICE '  Fichajes ................. %', v_fichajes;
    RAISE NOTICE '  Puntos GPS ............... %', v_puntos;
    RAISE NOTICE '  Turnos abiertos ahora .... %', v_activos;
    RAISE NOTICE '  Administradores maestros . %', v_masters;
    RAISE NOTICE '';
    RAISE NOTICE '  Maestro   99999999   JOSE MAESTRO';
    RAISE NOTICE '  Admin     @10001     LAURA VEGA    (Logistica Norte)';
    RAISE NOTICE '  Admin     @10002     MARCOS RUIZ   (Servicios Sur)';
    RAISE NOTICE '  Empleado  1001       ANA TORRES    (fichada ahora)';
    RAISE NOTICE '  Empleado  2001       HUGO PRIETO   (fichado ahora)';
    RAISE NOTICE '------------------------------------------------';

    IF v_masters <> 1 THEN
        RAISE WARNING 'Hay % administradores maestros. En una demo limpia deberia haber 1.', v_masters;
    END IF;
END
$resumen$;
