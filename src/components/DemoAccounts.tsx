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
            className="w-full max-w-md mt-6 mb-10 relative z-20"
        >
            <div className="bg-black/70 backdrop-blur-xl border border-cyan-500/20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,247,255,0.06)]">
                <button
                    type="button"
                    onClick={() => setAbierto((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
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
                            <div className="px-4 pb-4 space-y-2">
                                <p className="text-[10px] text-muted leading-relaxed px-1 pb-1">
                                    Pulsa una cuenta para entrar directamente.
                                </p>

                                {CUENTAS_DEMO.map((cuenta) => (
                                    <button
                                        key={cuenta.pin}
                                        type="button"
                                        disabled={cargando}
                                        onClick={() => onEntrar(cuenta.pin)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all duration-200
                                                    disabled:opacity-40 disabled:cursor-not-allowed
                                                    group/cuenta ${ESTILO_ROL[cuenta.rol]}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="shrink-0">{ICONO[cuenta.rol]}</div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[13px] font-black tracking-wide text-white">
                                                        {cuenta.nombre}
                                                    </span>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">
                                                        {ETIQUETA_ROL[cuenta.rol]}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-white/45 truncate">{cuenta.empresa}</p>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="font-mono text-[13px] font-bold tracking-[0.15em]">
                                                    {cuenta.pin}
                                                </span>
                                                <LogIn className="w-3.5 h-3.5 opacity-0 group-hover/cuenta:opacity-100 transition-opacity" />
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-white/35 mt-1.5 leading-relaxed">
                                            {cuenta.descripcion}
                                        </p>
                                    </button>
                                ))}

                                <p className="text-[10px] text-yellow-500/60 leading-relaxed px-1 pt-2 border-t border-white/5">
                                    Requiere haber ejecutado <code className="text-yellow-500/80">db/demo_seed.sql</code>.
                                    Este panel se oculta desde Configuración.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
