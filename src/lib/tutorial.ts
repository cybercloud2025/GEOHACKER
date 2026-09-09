/**
 * Contenido del tutorial.
 *
 * Va aparte de la pantalla para que actualizar el texto no obligue a tocar
 * maquetación, y para que el índice se genere solo a partir de las secciones.
 */

export type PublicoTutorial = 'todos' | 'empleado' | 'admin' | 'maestro';

export interface PasoTutorial {
    titulo: string;
    texto: string;
    /** Detalle que evita un error frecuente o explica un porqué. */
    nota?: string;
}

export interface SeccionTutorial {
    id: string;
    titulo: string;
    publico: PublicoTutorial;
    resumen: string;
    pasos: PasoTutorial[];
}

export const ETIQUETA_PUBLICO: Record<PublicoTutorial, string> = {
    todos: 'Todos',
    empleado: 'Empleado',
    admin: 'Administrador',
    maestro: 'Maestro',
};

export const COLOR_PUBLICO: Record<PublicoTutorial, string> = {
    todos: 'border-white/35 text-white/85 bg-white/10',
    empleado: 'border-cyan-400/60 text-cyan-300 bg-cyan-400/10',
    admin: 'border-purple-400/60 text-purple-300 bg-purple-400/10',
    maestro: 'border-red-400/60 text-red-300 bg-red-400/10',
};

export const SECCIONES: SeccionTutorial[] = [
    {
        id: 'que-es',
        titulo: 'Qué es GEOHACKER',
        publico: 'todos',
        resumen:
            'Un control de asistencia con geolocalización. Los empleados fichan desde el móvil ' +
            'y su empresa ve las horas trabajadas y por dónde se han movido durante la jornada.',
        pasos: [
            {
                titulo: 'Una aplicación, varias empresas',
                texto:
                    'Cada empresa funciona como un compartimento estanco. Un administrador solo ve ' +
                    'a sus propios empleados: nunca los de otra empresa, aunque compartan instalación.',
                nota: 'Ese aislamiento lo aplica el servidor, no la pantalla. No se puede sortear.',
            },
            {
                titulo: 'Sin contraseñas',
                texto:
                    'Se entra con un PIN. Es lo bastante rápido para fichar con guantes o con prisa, ' +
                    'que es cuando se usa de verdad.',
            },
            {
                titulo: 'La ubicación solo durante el turno',
                texto:
                    'La posición se registra únicamente mientras hay un turno abierto. Al fichar la ' +
                    'salida deja de guardarse nada.',
            },
        ],
    },
    {
        id: 'roles',
        titulo: 'Los tres roles',
        publico: 'todos',
        resumen: 'Quién puede hacer qué. El rol lo determina el tipo de PIN con el que se creó la cuenta.',
        pasos: [
            {
                titulo: 'Empleado — PIN de 4 dígitos',
                texto:
                    'Ficha entrada y salida, marca pausas y ve su propio cronómetro. No accede al panel ' +
                    'ni ve datos de nadie más.',
            },
            {
                titulo: 'Administrador — PIN con @ y 5 dígitos',
                texto:
                    'Gestiona a los empleados de su empresa: los da de alta, edita sus datos, consulta el ' +
                    'historial, ve el mapa en vivo y exporta informes.',
            },
            {
                titulo: 'Administrador Maestro',
                texto:
                    'Administra la plataforma: valida a los administradores nuevos, asigna empleados sueltos ' +
                    'a una empresa, cambia roles y puede entrar como cualquier administrador para dar soporte.',
                nota: 'Solo hay uno, y normalmente es quien opera el servicio.',
            },
        ],
    },
    {
        id: 'acceso',
        titulo: 'Entrar en la aplicación',
        publico: 'todos',
        resumen: 'La pantalla de acceso es un único campo. No hay usuario ni contraseña.',
        pasos: [
            {
                titulo: 'Escribe tu PIN',
                texto:
                    'En cuanto completas los dígitos, entra sola. No hay que pulsar ningún botón.',
                nota: 'Un empleado teclea 4 cifras. Un administrador empieza por @ y añade 5.',
            },
            {
                titulo: 'Si es la primera vez',
                texto:
                    'Pulsa «Establecer nueva identidad», rellena tus datos y elige un PIN de 4 dígitos. ' +
                    'Si tu empresa te ha dado un código tipo CORP-XXXX, ponlo: entrarás directamente en ella.',
                nota: 'Sin código, tu alta queda pendiente de que el Maestro te asigne a una empresa.',
            },
            {
                titulo: 'Cuentas nuevas pendientes',
                texto:
                    'Un alta recién creada aparece como TEMPORAL hasta que su administrador la valida. ' +
                    'Puede fichar igualmente; la validación es para que el administrador la reconozca.',
            },
        ],
    },
    {
        id: 'fichar',
        titulo: 'Fichar: el día a día',
        publico: 'empleado',
        resumen: 'La pantalla del empleado tiene un botón grande y poco más. Está pensada para usarse en la calle.',
        pasos: [
            {
                titulo: 'Fichar entrada',
                texto:
                    'Pulsa el botón de inicio. Se abre el turno, arranca el cronómetro y empieza a ' +
                    'registrarse tu recorrido.',
                nota: 'El navegador pedirá permiso de ubicación. Sin él la jornada se registra igual, pero sin mapa.',
            },
            {
                titulo: 'Pausas',
                texto:
                    'El botón de pausa detiene el cómputo e indica el motivo. Al volver, se reanuda. ' +
                    'Las pausas salen desglosadas en el informe.',
            },
            {
                titulo: 'Fichar salida',
                texto:
                    'Cierra el turno y detiene el seguimiento. Puedes añadir una nota, por ejemplo si ' +
                    'hubo una incidencia.',
            },
            {
                titulo: 'Cierre automático',
                texto:
                    'Sin turno abierto, la sesión se cierra sola a los cinco minutos. Es una protección ' +
                    'para móviles compartidos.',
                nota: 'Mientras estás fichado no se cierra nunca, aunque dejes el móvil quieto.',
            },
        ],
    },
    {
        id: 'usuarios',
        titulo: 'Gestionar tu equipo',
        publico: 'admin',
        resumen: 'La pestaña Usuarios del panel. Aquí das de alta a tu gente y mantienes sus datos.',
        pasos: [
            {
                titulo: 'Tu código de empresa',
                texto:
                    'Arriba del panel verás un código CORP-XXXX. Repártelo: quien se registre con él ' +
                    'entra directamente en tu empresa, sin que nadie tenga que asignarlo.',
            },
            {
                titulo: 'Crear un empleado a mano',
                texto:
                    'También puedes darlo de alta tú con «Registrar nuevo empleado». Nace ya validado y ' +
                    'solo tienes que decirle su PIN.',
            },
            {
                titulo: 'Validar altas',
                texto:
                    'Quien se registre por su cuenta aparece como TEMPORAL. Pulsa validar para confirmarlo.',
            },
            {
                titulo: 'Editar y eliminar',
                texto:
                    'Puedes cambiar nombre, correo y PIN. Al cambiar un PIN, esa persona sale de la sesión ' +
                    'al instante y tendrá que entrar con el nuevo.',
                nota: 'Eliminar a alguien borra también su historial y sus recorridos. No tiene vuelta atrás.',
            },
            {
                titulo: 'Quién está trabajando',
                texto:
                    'Junto a cada nombre hay dos señales: el pulgar indica que tiene la aplicación abierta, ' +
                    'y el marcador que está fichado y trabajando ahora mismo.',
            },
        ],
    },
    {
        id: 'historial',
        titulo: 'Historial e informes',
        publico: 'admin',
        resumen: 'Todas las jornadas de tu equipo, con horas, pausas y ubicación.',
        pasos: [
            {
                titulo: 'Consultar jornadas',
                texto:
                    'La pestaña Historial lista los fichajes del más reciente al más antiguo, con la ' +
                    'duración calculada y el número de pausas.',
            },
            {
                titulo: 'Ver el recorrido de un día',
                texto:
                    'El icono de mapa de cada fila abre el detalle de esa jornada, con los puntos de ' +
                    'entrada y de salida.',
            },
            {
                titulo: 'Exportar a PDF',
                texto:
                    'El botón de descarga genera un informe con la tabla completa. Antes de guardarlo se ' +
                    'muestra una vista previa.',
                nota: 'Útil para nóminas o para justificar horas ante una inspección.',
            },
        ],
    },
    {
        id: 'mapa',
        titulo: 'Mapa en tiempo real',
        publico: 'admin',
        resumen: 'Dónde está ahora mismo cada persona con un turno abierto.',
        pasos: [
            {
                titulo: 'Quién aparece',
                texto:
                    'Solo quienes tienen un turno abierto en ese momento. Al fichar la salida desaparecen ' +
                    'del mapa.',
            },
            {
                titulo: 'Qué muestra cada marcador',
                texto:
                    'Al pulsarlo verás el nombre, cuánto lleva trabajando, la batería del móvil y hace ' +
                    'cuánto llegó la última señal.',
            },
            {
                titulo: 'Se refresca solo',
                texto: 'Cada veinte segundos, sin recargar la página.',
                nota: 'Si alguien sale de cobertura, su marcador se queda en la última posición conocida.',
            },
            {
                titulo: 'Si no ves el mapa',
                texto:
                    'Falta la clave de Google Maps. Se añade en Configuración; el resto de la aplicación ' +
                    'funciona sin ella.',
            },
        ],
    },
    {
        id: 'maestro',
        titulo: 'Tareas del Administrador Maestro',
        publico: 'maestro',
        resumen: 'Las que afectan a toda la plataforma y no a una sola empresa.',
        pasos: [
            {
                titulo: 'Validar administradores',
                texto:
                    'Quien se registra como administrador no puede entrar hasta que lo validas. Al hacerlo, ' +
                    'recibe automáticamente su código de empresa.',
            },
            {
                titulo: 'Asignar empleados sueltos',
                texto:
                    'Si alguien se registró sin código de empresa, queda sin asignar. Desde «Validar y ' +
                    'Asignar» eliges a qué administrador pertenece.',
            },
            {
                titulo: 'Cambiar roles',
                texto: 'Puedes ascender a un empleado a administrador o degradarlo.',
                nota: 'Al cambiar un rol se cierran sus sesiones abiertas, para que los permisos se apliquen ya.',
            },
            {
                titulo: 'Entrar como otro administrador',
                texto:
                    'El icono de acceso abre la aplicación con su cuenta, para dar soporte viendo lo que ' +
                    've esa persona. Al cerrar sesión vuelves a la tuya.',
            },
            {
                titulo: 'Cerrar los registros',
                texto:
                    'El interruptor de registros bloquea las altas nuevas en toda la plataforma. Útil ' +
                    'mientras haces mantenimiento.',
            },
        ],
    },
    {
        id: 'demo',
        titulo: 'Esto es una demostración',
        publico: 'todos',
        resumen:
            'Si has llegado sin configurar nada, estás sobre datos ficticios que viven en tu navegador.',
        pasos: [
            {
                titulo: 'Qué puedes hacer',
                texto:
                    'Todo. Fichar, crear usuarios, validar altas, exportar informes. Se comporta igual que ' +
                    'la aplicación real.',
            },
            {
                titulo: 'Dónde van tus cambios',
                texto:
                    'A tu propio navegador, y a ningún sitio más. Nadie los ve y no salen del dispositivo.',
            },
            {
                titulo: 'Empezar de cero',
                texto:
                    'En Configuración, «Reiniciar datos de demostración» devuelve todo al estado inicial.',
            },
            {
                titulo: 'Prueba a comparar',
                texto:
                    'Entra con LAURA VEGA y mira su lista de empleados. Sal y entra con MARCOS RUIZ. ' +
                    'Son equipos distintos: eso es el aislamiento entre empresas funcionando.',
            },
        ],
    },
    {
        id: 'produccion',
        titulo: 'Usarlo de verdad',
        publico: 'admin',
        resumen: 'Pasar de la demostración a una instalación con datos reales.',
        pasos: [
            {
                titulo: 'Crea la base de datos',
                texto:
                    'Un proyecto gratuito en supabase.com. En su editor SQL, ejecuta el fichero ' +
                    'db/schema.sql del repositorio.',
                nota: 'Para una instalación real ejecuta solo ese fichero, sin los datos de demostración.',
            },
            {
                titulo: 'Conéctala',
                texto:
                    'En Configuración, pega la URL del proyecto y su clave anónima. La aplicación deja de ' +
                    'usar los datos ficticios en ese momento.',
            },
            {
                titulo: 'Cambia el PIN maestro',
                texto: 'Con db/set_master_pin.sql, antes de empezar a meter datos reales.',
            },
            {
                titulo: 'Una copia por cliente',
                texto:
                    'Si vas a entregarla a varias empresas, cada una puede tener su propia dirección y su ' +
                    'propia base de datos. El README explica cómo.',
                nota: 'Así sus empleados solo escriben el PIN: no configuran nada ni ven ninguna clave.',
            },
        ],
    },
];
