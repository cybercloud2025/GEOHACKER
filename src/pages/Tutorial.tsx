import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ArrowRight, BookOpen, ChevronLeft, KeyRound, Lightbulb,
} from 'lucide-react';
import {
    SECCIONES, ETIQUETA_PUBLICO, COLOR_PUBLICO,
    type PublicoTutorial,
} from '../lib/tutorial';

const FILTROS: PublicoTutorial[] = ['todos', 'empleado', 'admin', 'maestro'];

/**
 * Tutorial completo de uso.
 *
 * Va por solapas y no como una página continua: cada sección cabe en pantalla,
 * así que no hay que desplazarse para leerla entera ni para saltar a otra.
 *
 * Tiene dirección propia (/tutorial) en vez de ser una ventana emergente, para
 * poder enlazarlo, marcarlo o imprimirlo, y se abre sin haber iniciado sesión:
 * buena parte de las dudas surgen antes de entrar.
 */
export const TutorialPage = () => {
    const navigate = useNavigate();
    const [filtro, setFiltro] = useState<PublicoTutorial>('todos');
    const [activa, setActiva] = useState(SECCIONES[0].id);

    const visibles = useMemo(
        () => SECCIONES.filter(
            (s) => filtro === 'todos' || s.publico === filtro || s.publico === 'todos'
        ),
        [filtro]
    );

    // Si el filtro deja fuera la solapa abierta, se cae a la primera disponible.
    const indice = Math.max(0, visibles.findIndex((s) => s.id === activa));
    const seccion = visibles[indice] ?? visibles[0];

    const irA = (id: string) => {
        setActiva(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cambiarFiltro = (f: PublicoTutorial) => {
        setFiltro(f);
        const nuevas = SECCIONES.filter(
            (s) => f === 'todos' || s.publico === f || s.publico === 'todos'
        );
        if (!nuevas.some((s) => s.id === activa)) setActiva(nuevas[0].id);
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8">

                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 text-xs uppercase tracking-widest font-bold"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                </button>

                <header className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <BookOpen className="w-7 h-7 text-[#39FF14]" />
                        <h1 className="text-4xl font-black tracking-tight">CÓMO SE USA</h1>
                    </div>
                    <p className="text-white/70 text-base max-w-2xl leading-relaxed">
                        Guía completa de GEOHACKER. Elige un apartado; cada uno cabe en pantalla.
                    </p>
                </header>

                {/* Filtro por rol */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {FILTROS.map((f) => (
                        <button
                            key={f}
                            onClick={() => cambiarFiltro(f)}
                            className={`px-4 py-2 rounded-xl border text-[12px] font-black uppercase tracking-widest transition-all
                                ${filtro === f
                                    ? 'border-[#39FF14]/60 text-[#39FF14] bg-[#39FF14]/10 shadow-[0_0_20px_rgba(57,255,20,0.15)]'
                                    : 'border-white/15 text-white/55 hover:text-white hover:border-white/35'}`}
                        >
                            {f === 'todos' ? 'Todo' : ETIQUETA_PUBLICO[f]}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Solapas. En horizontal y con desplazamiento lateral en móvil,
                        en vertical cuando hay ancho. */}
                    <nav className="lg:w-64 shrink-0">
                        <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-6">
                            {visibles.map((s, i) => {
                                const abierta = s.id === seccion.id;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => irA(s.id)}
                                        className={`shrink-0 lg:shrink text-left px-4 py-3 rounded-xl border transition-all
                                            whitespace-nowrap lg:whitespace-normal
                                            ${abierta
                                                ? 'border-[#39FF14]/50 bg-[#39FF14]/10 text-[#39FF14] shadow-[0_0_18px_rgba(57,255,20,0.12)]'
                                                : 'border-white/10 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/5'}`}
                                    >
                                        <span className={`font-mono text-[11px] mr-2 ${abierta ? 'opacity-80' : 'opacity-40'}`}>
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <span className="text-[14px] font-bold">{s.titulo}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Contenido de la solapa abierta */}
                    <div className="flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.section
                                key={seccion.id}
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -12 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center gap-3 flex-wrap mb-3">
                                    <h2 className="text-3xl font-black tracking-tight text-white">
                                        {seccion.titulo}
                                    </h2>
                                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${COLOR_PUBLICO[seccion.publico]}`}>
                                        {ETIQUETA_PUBLICO[seccion.publico]}
                                    </span>
                                </div>

                                <p className="text-[17px] text-cyan-200/90 leading-relaxed mb-6">
                                    {seccion.resumen}
                                </p>

                                <ol className="space-y-3">
                                    {seccion.pasos.map((paso, i) => (
                                        <li
                                            key={paso.titulo}
                                            className="p-5 rounded-xl border border-white/12 bg-white/[0.04] hover:border-[#39FF14]/30 transition-colors"
                                        >
                                            <div className="flex items-baseline gap-3">
                                                <span className="font-mono text-[13px] text-[#39FF14]/70 shrink-0">
                                                    {indice + 1}.{i + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <h3 className="text-[16px] font-black uppercase tracking-wide text-white mb-1.5">
                                                        {paso.titulo}
                                                    </h3>
                                                    <p className="text-[16px] text-white/85 leading-relaxed">
                                                        {paso.texto}
                                                    </p>
                                                    {paso.nota && (
                                                        <p className="flex gap-2.5 mt-3 text-[15px] text-yellow-300/90 leading-relaxed">
                                                            <Lightbulb className="w-4 h-4 shrink-0 mt-1" />
                                                            {paso.nota}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </motion.section>
                        </AnimatePresence>

                        {/* Recorrido secuencial, para quien lo lee de principio a fin */}
                        <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-white/10">
                            <button
                                onClick={() => irA(visibles[indice - 1].id)}
                                disabled={indice === 0}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-white/70 text-[12px]
                                           font-black uppercase tracking-widest hover:text-white hover:border-white/35
                                           disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Anterior
                            </button>

                            <span className="font-mono text-[12px] text-white/40">
                                {indice + 1} / {visibles.length}
                            </span>

                            {indice < visibles.length - 1 ? (
                                <button
                                    onClick={() => irA(visibles[indice + 1].id)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#39FF14]/40 text-[#39FF14] text-[12px]
                                               font-black uppercase tracking-widest hover:bg-[#39FF14]/10 transition-colors"
                                >
                                    Siguiente
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <Link
                                    to="/login"
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#39FF14] text-[#39FF14] text-[12px]
                                               font-black uppercase tracking-widest hover:bg-[#39FF14] hover:text-black transition-colors"
                                >
                                    <KeyRound className="w-4 h-4" />
                                    Probarlo
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
