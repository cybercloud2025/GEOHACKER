import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Lightbulb, KeyRound } from 'lucide-react';
import {
    SECCIONES, ETIQUETA_PUBLICO, COLOR_PUBLICO,
    type PublicoTutorial,
} from '../lib/tutorial';

const FILTROS: PublicoTutorial[] = ['todos', 'empleado', 'admin', 'maestro'];

/**
 * Tutorial completo de uso.
 *
 * Es una página con dirección propia (/tutorial) y no una ventana emergente,
 * para poder enlazarla, marcarla o imprimirla. Se puede abrir sin haber
 * iniciado sesión: buena parte de las dudas surgen antes de entrar.
 */
export const TutorialPage = () => {
    const navigate = useNavigate();
    // 'todos' no filtra: muestra el tutorial entero.
    const [filtro, setFiltro] = useState<PublicoTutorial>('todos');

    const visibles = SECCIONES.filter(
        (s) => filtro === 'todos' || s.publico === filtro || s.publico === 'todos'
    );

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-10">

                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-muted hover:text-white transition-colors mb-8 text-xs uppercase tracking-widest font-bold"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                </button>

                <header className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <BookOpen className="w-7 h-7 text-cyan-400" />
                        <h1 className="text-4xl font-black tracking-tight">CÓMO SE USA</h1>
                    </div>
                    <p className="text-muted text-sm max-w-2xl leading-relaxed">
                        Guía completa de GEOHACKER, desde fichar una jornada hasta administrar la
                        plataforma. Si solo te interesa una parte, filtra por tu papel.
                    </p>
                </header>

                {/* Filtro por rol */}
                <div className="flex flex-wrap gap-2 mb-10">
                    {FILTROS.map((f) => (
                        <button
                            key={f}
                            onClick={() => setFiltro(f)}
                            className={`px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all
                                ${filtro === f
                                    ? 'border-cyan-500/60 text-cyan-300 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,247,255,0.12)]'
                                    : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/25'}`}
                        >
                            {f === 'todos' ? 'Todo el tutorial' : ETIQUETA_PUBLICO[f]}
                        </button>
                    ))}
                </div>

                <div className="flex gap-10">

                    {/* Índice: se queda fijo al desplazar, solo si hay ancho */}
                    <nav className="hidden lg:block w-56 shrink-0">
                        <div className="sticky top-10 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-3 px-3">
                                Contenido
                            </p>
                            {visibles.map((s, i) => (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className="block px-3 py-2 rounded-lg text-[12px] text-white/45 hover:text-cyan-400 hover:bg-white/5 transition-colors leading-snug"
                                >
                                    <span className="font-mono text-[10px] opacity-50 mr-2">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    {s.titulo}
                                </a>
                            ))}
                        </div>
                    </nav>

                    {/* Secciones */}
                    <div className="flex-1 min-w-0 space-y-12">
                        {visibles.map((seccion, indice) => (
                            <motion.section
                                key={seccion.id}
                                id={seccion.id}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-60px' }}
                                transition={{ duration: 0.35 }}
                                className="scroll-mt-10"
                            >
                                <div className="flex items-start gap-4 mb-5">
                                    <span className="font-mono text-3xl font-black text-cyan-500/25 leading-none pt-1">
                                        {String(indice + 1).padStart(2, '0')}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                            <h2 className="text-2xl font-black tracking-tight">
                                                {seccion.titulo}
                                            </h2>
                                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-widest ${COLOR_PUBLICO[seccion.publico]}`}>
                                                {ETIQUETA_PUBLICO[seccion.publico]}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted leading-relaxed">
                                            {seccion.resumen}
                                        </p>
                                    </div>
                                </div>

                                <ol className="space-y-3 lg:pl-14">
                                    {seccion.pasos.map((paso, i) => (
                                        <li
                                            key={paso.titulo}
                                            className="p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-500/25 transition-colors"
                                        >
                                            <div className="flex items-baseline gap-3">
                                                <span className="font-mono text-[11px] text-cyan-500/60 shrink-0">
                                                    {indice + 1}.{i + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <h3 className="text-[13px] font-black uppercase tracking-wider text-white mb-1">
                                                        {paso.titulo}
                                                    </h3>
                                                    <p className="text-[13px] text-white/55 leading-relaxed">
                                                        {paso.texto}
                                                    </p>
                                                    {paso.nota && (
                                                        <p className="flex gap-2 mt-2.5 text-[12px] text-yellow-500/70 leading-relaxed">
                                                            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                            {paso.nota}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </motion.section>
                        ))}

                        <div className="pt-8 border-t border-white/10 flex flex-wrap gap-3">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-cyan-500/40 text-cyan-400
                                           text-[11px] font-black uppercase tracking-widest hover:bg-cyan-500/10 transition-colors"
                            >
                                <KeyRound className="w-4 h-4" />
                                Ir al acceso y probarlo
                            </Link>
                            <Link
                                to="/configuracion"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 text-white/50
                                           text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-white/30 transition-colors"
                            >
                                Configuración
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
