import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Crown, Shield, User, LogIn } from 'lucide-react';
import { CUENTAS_DEMO, ETIQUETA_ROL, ESTILO_ROL, type RolDemo } from '../lib/demoAccounts';

interface DemoAccountsProps {
    /** Recibe el PIN de la cuenta elegida y ejecuta el acceso normal. */
    onEntrar: (pin: string) => void;
    cargando?: boolean;
}

const ICONO: Record<RolDemo, React.ReactNode> = {
    maestro: <Crown className="w-4 h-4" />,
    admin: <Shield className="w-4 h-4" />,
    empleado: <User className="w-4 h-4" />,
};

/**
 * Accesos rápidos a las cuentas de db/demo_seed.sql.
 *
 * Pulsar una tarjeta hace exactamente el mismo login que teclear el PIN: la
 * credencial la valida la base de datos. Si el seed no se ha ejecutado, el
 * acceso falla como cualquier PIN inexistente.
 */
export const DemoAccounts = ({ onEntrar, cargando }: DemoAccountsProps) => {
    const [abierto, setAbierto] = useState(true);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            // Estrecho en móvil (una columna) y ancho en escritorio, donde caben tres.
            className="w-full max-w-md lg:max-w-4xl mt-3 mb-6 relative z-20"
        >
            <div className="bg-black/70 backdrop-blur-xl border border-cyan-500/20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,247,255,0.06)]">
                <button
                    type="button"
                    onClick={() => setAbierto((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-white/[0.03] transition-colors"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400">
                            Cuentas de demostración
                        </span>
                    </div>
                    <ChevronDown
                        className={`w-4 h-4 text-muted shrink-0 transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}
                    />
                </button>

                <AnimatePresence initial={false}>
                    {abierto && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className="px-3 pb-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {CUENTAS_DEMO.map((cuenta) => (
                                        <button
                                            key={cuenta.pin}
                                            type="button"
                                            disabled={cargando}
                                            onClick={() => onEntrar(cuenta.pin)}
                                            className={`text-left p-3 rounded-xl border transition-all duration-200
                                                        flex flex-col h-full
                                                        disabled:opacity-40 disabled:cursor-not-allowed
                                                        group/cuenta ${ESTILO_ROL[cuenta.rol]}`}
                                        >
                                            {/* Cabecera: rol a la izquierda, PIN a la derecha */}
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="shrink-0">{ICONO[cuenta.rol]}</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 truncate">
                                                        {ETIQUETA_ROL[cuenta.rol]}
                                                    </span>
                                                </div>
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                    <LogIn className="w-3 h-3 opacity-0 group-hover/cuenta:opacity-70 transition-opacity" />
                                                    <span className="font-mono text-[13px] font-bold tracking-[0.1em]">
                                                        {cuenta.pin}
                                                    </span>
                                                </span>
                                            </div>

                                            <div className="text-[13px] font-black tracking-wide text-white leading-tight">
                                                {cuenta.nombre}
                                            </div>
                                            <p className="text-[10px] text-white/45 truncate mb-1.5">
                                                {cuenta.empresa}
                                            </p>

                                            {/* flex-1 empuja el pie hacia abajo: todas las tarjetas de una
                                                fila quedan alineadas aunque el texto tenga distinto largo. */}
                                            <p className="text-[10px] text-white/35 leading-snug line-clamp-2 flex-1">
                                                {cuenta.descripcion}
                                            </p>
                                        </button>
                                    ))}
                                </div>

                                <p className="text-[10px] text-yellow-500/60 px-1 pt-2 mt-2 border-t border-white/5">
                                    Requiere <code className="text-yellow-500/80">db/demo_seed.sql</code>. Se oculta desde Configuración.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
