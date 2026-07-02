import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Clock, Activity, Shield, Mail, Hash, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

interface UserDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any; // Using any for now to match the flexible user object in Admin.tsx
    history?: any[]; // Optional full history to filter for this user
}

export const UserDetailsModal = ({ isOpen, onClose, user, history = [] }: UserDetailsModalProps) => {
    if (!isOpen || !user) return null;

    // Filter recent history for this user
    const userHistory = history.filter(h => h.employee_name === `${user.first_name} ${user.last_name}`).slice(0, 5);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-4xl bg-[#050505] border border-cyan-500/50 rounded-lg shadow-[0_0_100px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* --- CYBERPUNK DECORATIONS --- */}
                    {/* Top Left Corner */}
                    <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-cyan-400 rounded-tl-lg pointer-events-none z-20 opacity-50"></div>
                    {/* Bottom Right Corner */}
                    <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-cyan-400 rounded-br-lg pointer-events-none z-20 opacity-50"></div>
                    {/* Scanning Line Animation */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent bg-[length:100%_200%] animate-scan pointer-events-none z-0"></div>
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0"></div>

                    {/* --- HEADER --- */}
                    <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/10 bg-white/5 backdrop-blur-xl">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-cyan-950/30 border border-cyan-500/30 rounded-lg">
                                <Shield className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white tracking-widest uppercase font-mono">
                                    {user.role === 'admin' ? 'EXPEDIENTE DE ADMINISTRADOR' : 'EXPEDIENTE DE USUARIO'}
                                </h2>
                                <p className="text-xs text-cyan-400 font-mono tracking-[0.2em] opacity-70">
                                    CONFIDENTIAL // RESTRICTED ACCESS
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 border border-transparent rounded-lg transition-all duration-300"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* --- LEFT COLUMN: IDENTITY CARD --- */}
                            <div className="lg:col-span-4 space-y-6">
                                {/* Avatar Card */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                    <div className="w-40 h-40 rounded-full border-4 border-black ring-2 ring-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-6 overflow-hidden relative">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-cyan-950 flex items-center justify-center">
                                                <User className="w-16 h-16 text-cyan-400" />
                                            </div>
                                        )}
                                        {/* Scan Effect Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent -translate-y-full hover:animate-scan-fast pointer-events-none"></div>
                                    </div>

                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                                        {user.first_name} <br /> <span className="text-cyan-400">{user.last_name}</span>
                                    </h3>

                                    <div className="w-full space-y-2 mt-4">
                                        <div className={`w-full py-1.5 rounded border text-xs font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-blue-500/20 border-blue-500/50 text-blue-300'}`}>
                                            {user.role === 'admin' ? 'NIVEL: ADMIN' : 'NIVEL: AGENTE'}
                                        </div>
                                        <div className={`w-full py-1.5 rounded border text-xs font-black uppercase tracking-widest ${user.verified ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'}`}>
                                            {user.verified ? 'ESTADO: VERIFICADO' : 'ESTADO: PENDIENTE'}
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
                                        <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Fichajes Totales</div>
                                        <div className="text-2xl font-mono font-bold text-white">{history ? history.length : 0}</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
                                        <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Rendimiento</div>
                                        <div className="text-2xl font-mono font-bold text-green-400">100%</div>
                                    </div>
                                </div>
                            </div>

                            {/* --- RIGHT COLUMN: DETAILED INFO --- */}
                            <div className="lg:col-span-8 space-y-8">

                                {/* 1. Data Grid */}
                                <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                                    <div className="bg-white/5 px-6 py-3 border-b border-white/10 flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                            <Activity className="w-4 h-4" /> Datos de Sistema
                                        </h4>
                                        <span className="text-[10px] text-gray-500 font-mono">SECURE_CONNECTION_ESTABLISHED</span>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Correo Electrónico</label>
                                            <div className="text-white font-mono text-sm bg-white/5 border border-white/10 px-3 py-2 rounded flex items-center gap-2">
                                                <Mail className="w-3 h-3 text-cyan-500" />
                                                {user.employee_email || '-----'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Identificador Único (UUID)</label>
                                            <div className="text-gray-300 font-mono text-xs bg-white/5 border border-white/10 px-3 py-2 rounded flex items-center gap-2 overflow-hidden">
                                                <Hash className="w-3 h-3 text-cyan-500" />
                                                <span className="truncate">{user.id}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Configuración de Seguridad</label>
                                            <div className="text-white font-mono text-sm bg-white/5 border border-white/10 px-3 py-2 rounded flex items-center gap-2">
                                                <Shield className="w-3 h-3 text-purple-500" />
                                                PIN DE ACCESO ACTIVO
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Dispositivo Habitual</label>
                                            <div className="text-white font-mono text-sm bg-white/5 border border-white/10 px-3 py-2 rounded flex items-center gap-2">
                                                <Smartphone className="w-3 h-3 text-green-500" />
                                                DESCONOCIDO
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Log Terminal (Recent Activity) */}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <Clock className="w-4 h-4" /> Registro de Actividad (Log)
                                    </h4>
                                    <div className="bg-black border border-white/10 rounded-xl overflow-hidden font-mono text-xs">
                                        <div className="bg-white/5 border-b border-white/10 px-4 py-2 flex text-gray-500 text-[10px] uppercase tracking-wider">
                                            <div className="w-32">Timestamp</div>
                                            <div className="w-24">Estado</div>
                                            <div className="flex-1">Detalles de Sesión</div>
                                        </div>
                                        <div className="divide-y divide-white/5 max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {userHistory.length > 0 ? (
                                                userHistory.map((h, i) => (
                                                    <div key={i} className="px-4 py-3 flex hover:bg-white/5 transition-colors group">
                                                        <div className="w-32 text-cyan-300 group-hover:text-cyan-200">
                                                            {format(new Date(h.start_time), 'yyyy-MM-dd HH:mm')}
                                                        </div>
                                                        <div className="w-24">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${h.status === 'completed' ? 'text-gray-400 border border-gray-700' : 'text-green-400 border border-green-900 bg-green-900/20'}`}>
                                                                {h.status === 'completed' ? 'CLOSED' : 'ACTIVE'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 text-gray-400 group-hover:text-white truncate">
                                                            {h.end_time
                                                                ? `Sesión finalizada a las ${format(new Date(h.end_time), 'HH:mm')}`
                                                                : 'Sesión en curso actualmente...'}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center text-gray-600 italic">
                                                    // NO SE HAN ENCONTRADO REGISTROS EN EL SISTEMA
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
