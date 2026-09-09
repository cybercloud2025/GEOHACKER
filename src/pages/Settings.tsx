import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Check, Database, Eye, EyeOff, KeyRound, Mail,
    MapPin, RotateCcw, Save, ShieldAlert, Users,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import {
    CAMPOS, useConfigStore, useConfig, origenDe,
    supabaseConfigurado, googleMapsConfigurado, emailConfigurado,
    type AppConfig, type ClaveConfig,
} from '../lib/config';

const VACIA: AppConfig = {
    supabaseUrl: '', supabaseAnonKey: '', googleMapsApiKey: '',
    emailjsPublicKey: '', emailjsServiceId: '',
    emailjsTemplateWelcomeId: '', emailjsTemplateResetId: '',
};

/** Deja visible el principio y el final para poder reconocer una clave larga. */
const enmascarar = (valor: string) => {
    if (valor.length <= 12) return '•'.repeat(valor.length);
    return `${valor.slice(0, 6)}${'•'.repeat(14)}${valor.slice(-4)}`;
};

const Estado = ({ ok, icono, titulo, detalle }: {
    ok: boolean; icono: React.ReactNode; titulo: string; detalle: string;
}) => (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${ok
        ? 'bg-emerald-500/5 border-emerald-500/30'
        : 'bg-yellow-500/5 border-yellow-500/30'}`}>
        <div className={ok ? 'text-emerald-400' : 'text-yellow-400'}>{icono}</div>
        <div className="min-w-0">
            <p className={`text-xs font-black uppercase tracking-widest ${ok ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {titulo}
            </p>
            <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{detalle}</p>
        </div>
    </div>
);

export const SettingsPage = () => {
    const navigate = useNavigate();
    const configEfectiva = useConfig();
    const { guardar, limpiar, showDemoAccounts, setShowDemoAccounts } = useConfigStore();

    // El formulario arranca vacío a propósito: cada campo muestra como marcador
    // el valor que ya está en uso, y solo se escribe lo que se quiera cambiar.
    const [borrador, setBorrador] = useState<AppConfig>(VACIA);
    const [visibles, setVisibles] = useState<Record<string, boolean>>({});
    const [guardado, setGuardado] = useState(false);

    const cambiar = (clave: ClaveConfig, valor: string) => {
        setBorrador((prev) => ({ ...prev, [clave]: valor }));
        setGuardado(false);
    };

    const onGuardar = (e: React.FormEvent) => {
        e.preventDefault();
        guardar(borrador);
        setBorrador(VACIA);
        setGuardado(true);
    };

    const onLimpiar = () => {
        const seguro = window.confirm(
            '¿Borrar la configuración guardada en este navegador?\n\n' +
            'Se volverán a usar los valores que traiga la aplicación, si los hay.'
        );
        if (!seguro) return;
        limpiar();
        setBorrador(VACIA);
        setGuardado(false);
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-10">
            {/* Fondo */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="relative z-10 max-w-3xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-muted hover:text-white transition-colors mb-8 text-xs uppercase tracking-widest font-bold"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                </button>

                <header className="mb-10">
                    <h1 className="text-4xl font-black tracking-tight mb-2">CONFIGURACIÓN</h1>
                    <p className="text-muted text-sm max-w-xl leading-relaxed">
                        Conecta la aplicación con tus propios servicios. Todo lo que introduzcas
                        se guarda <strong className="text-white">únicamente en este navegador</strong>:
                        no viaja a ningún servidor ni queda dentro de la aplicación publicada.
                    </p>
                </header>

                {/* Estado actual */}
                <section className="grid gap-3 sm:grid-cols-3 mb-10">
                    <Estado
                        ok={supabaseConfigurado()}
                        icono={<Database className="w-5 h-5" />}
                        titulo="Base de datos"
                        detalle={supabaseConfigurado()
                            ? 'Conectada. La aplicación puede iniciar sesión y guardar fichajes.'
                            : 'Obligatoria. Sin ella no se puede entrar.'}
                    />
                    <Estado
                        ok={googleMapsConfigurado()}
                        icono={<MapPin className="w-5 h-5" />}
                        titulo="Mapas"
                        detalle={googleMapsConfigurado()
                            ? 'Los mapas y el seguimiento en vivo se muestran.'
                            : 'Opcional. Sin clave el resto sigue funcionando.'}
                    />
                    <Estado
                        ok={emailConfigurado()}
                        icono={<Mail className="w-5 h-5" />}
                        titulo="Correo"
                        detalle={emailConfigurado()
                            ? 'Se envían avisos de alta y validación.'
                            : 'Opcional. Sin esto no se manda ningún correo.'}
                    />
                </section>

                {!supabaseConfigurado() && (
                    <div className="flex gap-3 p-4 mb-8 rounded-xl border border-red-500/40 bg-red-500/5">
                        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-200 leading-relaxed">
                            Falta la conexión con Supabase. Crea un proyecto gratuito en supabase.com,
                            ejecuta <code className="text-red-300">db/schema.sql</code> en su editor SQL
                            y pega aquí la URL y la clave anónima.
                        </p>
                    </div>
                )}

                <form onSubmit={onGuardar} className="space-y-6">
                    {CAMPOS.map((campo) => {
                        const origen = origenDe(campo.clave);
                        const actual = configEfectiva[campo.clave];
                        const visible = visibles[campo.clave] === true;

                        return (
                            <div key={campo.clave} className="space-y-2">
                                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/80">
                                        {campo.etiqueta}
                                        {campo.obligatorio && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <span className={`text-[10px] uppercase tracking-widest font-bold ${origen === 'usuario' ? 'text-cyan-400'
                                        : origen === 'entorno' ? 'text-purple-400' : 'text-white/25'}`}>
                                        {origen === 'usuario' ? 'guardado aquí'
                                            : origen === 'entorno' ? 'viene con la app' : 'sin definir'}
                                    </span>
                                </div>

                                <div className="relative">
                                    <input
                                        type={campo.secreto && !visible ? 'password' : 'text'}
                                        value={borrador[campo.clave]}
                                        onChange={(e) => cambiar(campo.clave, e.target.value)}
                                        placeholder={actual
                                            ? (campo.secreto ? enmascarar(actual) : actual)
                                            : campo.marcador}
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm font-mono
                                                   text-white placeholder:text-white/25 outline-none transition-all
                                                   focus:border-cyan-500/50 focus:bg-white/10"
                                    />
                                    {campo.secreto && (
                                        <button
                                            type="button"
                                            onClick={() => setVisibles((v) => ({ ...v, [campo.clave]: !visible }))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                                            title={visible ? 'Ocultar' : 'Mostrar'}
                                        >
                                            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>

                                <p className="text-[11px] text-muted leading-relaxed">{campo.ayuda}</p>
                            </div>
                        );
                    })}

                    {/* Cuentas de demostración */}
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <Users className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showDemoAccounts}
                                    onChange={(e) => setShowDemoAccounts(e.target.checked)}
                                    className="w-4 h-4 accent-cyan-500"
                                />
                                <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                                    Mostrar cuentas de prueba en el acceso
                                </span>
                            </label>
                            <p className="text-[11px] text-muted mt-2 leading-relaxed">
                                Añade bajo el formulario de acceso una lista de cuentas con las que entrar
                                de un clic. Requiere haber ejecutado <code>db/demo_seed.sql</code>.
                                <strong className="text-yellow-500/90"> Desactívalo si la instalación tiene datos reales:</strong> deja
                                los PIN a la vista de cualquiera.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                        <Button type="submit" className="flex-1 min-w-[200px]">
                            {guardado ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {guardado ? 'Guardado' : 'Guardar configuración'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={onLimpiar}>
                            <RotateCcw className="w-4 h-4" />
                            Borrar lo guardado
                        </Button>
                        <Link to="/login" className="contents">
                            <Button type="button" variant="ghost">
                                <KeyRound className="w-4 h-4" />
                                Ir al acceso
                            </Button>
                        </Link>
                    </div>
                </form>

                <p className="text-[11px] text-muted mt-10 leading-relaxed border-t border-white/5 pt-6">
                    Los campos vacíos no borran nada: solo se actualiza lo que escribas. Para
                    devolver un valor al que trae la aplicación, usa «Borrar lo guardado».
                    Estas claves son de cliente y quedan expuestas en cualquier aplicación web;
                    protégelas restringiendo su uso desde el panel de cada proveedor.
                </p>
            </div>
        </div>
    );
};
