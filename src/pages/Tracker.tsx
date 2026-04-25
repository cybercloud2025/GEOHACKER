import { useEffect, useRef, useState } from 'react';
import { Play, Square, LogOut, Coffee, Crosshair, MapPin, Shield, AlertTriangle, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* --- GOOGLE MAPS IMPORTS --- */
import { GoogleMapWrapper } from '../components/GoogleMap/GoogleMapWrapper';
import { TrackerMapGoogle } from '../components/Tracker/TrackerMapGoogle';

import { useTimeStore } from '../stores/useTimeStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useLocationTracker } from '../hooks/useLocationTracker';

export const TrackerPage = () => {
    const { employee, logout } = useAuthStore();
    const { status, clockIn, clockOut, startBreak, endBreak, startTime, lastKnownLocation, syncStatus, updateLocation } = useTimeStore();

    // Activate background tracking
    useLocationTracker();

    // Status helpers
    const isActive = status === 'active';
    const isBreak = status === 'break';
    const isIdle = status === 'idle';

    // Format Start Time
    const formattedStartTime = startTime ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

    // Manual Locate Handler
    const handleLocate = () => {
        if (!navigator.geolocation) return;

        const handleCoords = (pos: GeolocationPosition) => {
            updateLocation({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp
            });
        };

        navigator.geolocation.getCurrentPosition(
            handleCoords,
            () => navigator.geolocation.getCurrentPosition(handleCoords, () => { }, { enableHighAccuracy: false, timeout: 10000 }),
            { enableHighAccuracy: true, timeout: 5000 }
        );
    };

    useEffect(() => {
        syncStatus();
        handleLocate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-logout with visual countdown
    const [timeLeft, setTimeLeft] = useState(20);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (status === 'idle') {
            setTimeLeft(20);
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        logout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeLeft(20);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [status, logout]);

    // Calculate center for Google Map
    const mapCenter = lastKnownLocation
        ? { lat: lastKnownLocation.latitude, lng: lastKnownLocation.longitude }
        : null;

    return (
        <div className="relative h-screen flex flex-col overflow-hidden bg-black font-sans selection:bg-cyan-500/20">

            {/* MAP LAYER (Full screen background) - Dark & High Contrast */}
            <div className="absolute inset-0 z-0 grayscale invert opacity-40 contrast-125">
                <GoogleMapWrapper>
                    <TrackerMapGoogle center={mapCenter} />
                </GoogleMapWrapper>
            </div>

            {/* Matrix Overlay - Subtle Cyberpunk Feel */}
            <div className="absolute inset-0 z-10 pointer-events-none opacity-20 bg-[linear-gradient(rgba(0,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />

            {/* TOP BAR / SYSTEM INFO */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 md:p-6 flex flex-col items-start pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4 pointer-events-auto"
                >
                    {/* Terminal de Identidad Principal - Estilo HUD Cyberpunk */}
                    <div className="bg-black/60 backdrop-blur-3xl border border-cyan-500/20 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(0,247,255,0.1)] flex items-center gap-4 relative overflow-hidden group min-w-[300px]">
                        {/* Brillo de Acento de Estado (Lado Dinámico) */}
                        <div
                            className={`absolute top-0 right-0 w-1.5 h-full transition-all duration-700
                                ${isActive ? 'bg-cyan-500 shadow-[-2px_0_15px_rgba(6,182,212,0.8)]' : isBreak ? 'bg-yellow-500 shadow-[-2px_0_15px_rgba(234,179,8,0.5)]' : 'bg-red-500 shadow-[-2px_0_15px_rgba(239,68,68,0.5)]'}
                             `}
                        />

                        <div className="relative shrink-0">
                            <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl font-black transition-all duration-500 shadow-[0_0_15px_rgba(255,255,255,0.1)]
                                ${isActive ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-400' : isBreak ? 'bg-yellow-950/30 border-yellow-500/50 text-yellow-400' : 'bg-red-950/30 border-red-500/50 text-red-500'}
                            `}>
                                {employee?.avatar_url ? (
                                    <img src={employee.avatar_url} className="w-full h-full object-cover rounded-full" alt="User" />
                                ) : (
                                    employee?.first_name?.charAt(0)
                                )}
                            </div>
                            {isActive && <div className="absolute top-0 right-0 w-4 h-4 bg-cyan-500 border-2 border-black rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />}
                        </div>

                        {/* Métricas de Texto */}
                        <div className="flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-black tracking-widest text-base uppercase glitch-text-sm" data-text={employee?.first_name}>{employee?.first_name} {employee?.last_name}</span>
                                {employee?.verified ? (
                                    <Shield className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                ) : (
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <AnimatePresence mode="wait">
                                    {isActive ? (
                                        <motion.div
                                            key="status-active"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-cyan-500/10 rounded-full border border-cyan-500/30 text-[8px] font-black text-cyan-400 tracking-[0.2em] flex items-center gap-1.5"
                                        >
                                            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
                                            CONECTADO // {formattedStartTime}
                                        </motion.div>
                                    ) : isBreak ? (
                                        <motion.div
                                            key="status-break"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/30 text-[8px] font-black text-yellow-400 tracking-[0.2em] uppercase"
                                        >
                                            EN RECESO
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="status-idle"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/30 text-[8px] font-black text-red-400 tracking-[0.2em] uppercase"
                                        >
                                            DESCONECTADO
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div className="text-[8px] font-mono text-cyan-500/50 font-medium tracking-tight">V8.1.00</div>
                            </div>
                        </div>
                    </div>

                    {/* Alerta de Verificación - Hacker Style */}
                    {!employee?.verified && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-red-500/10 backdrop-blur-md border border-red-500/30 rounded-xl p-2 flex items-center gap-2 max-w-[260px] shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                        >
                            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 animate-pulse" />
                            <p className="text-[9px] text-red-400 leading-none font-bold uppercase tracking-widest">PERFIL NO VALIDADO // ACCESS_DENIED</p>
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* --- CENTRO OPERACIONAL INFERIOR --- */}
            <div className="absolute bottom-0 left-0 right-0 z-40 p-6 md:p-12 flex flex-col items-center gap-8 pointer-events-none">

                {/* TEMPORIZADOR DE INACTIVIDAD - Estilo Cyber */}
                <AnimatePresence>
                    {isIdle && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center bg-black/80 backdrop-blur-xl px-10 py-5 rounded-3xl border-2 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)] mb-4 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-pulse" />
                            <span className="text-[10px] font-black text-red-400 tracking-[0.4em] uppercase mb-1 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">TERMINACIÓN DE SESIÓN</span>
                            <div className="text-6xl font-mono text-white font-bold tracking-tighter mb-1">
                                {timeLeft.toString().padStart(2, '0')}<span className="text-red-600 animate-pulse">s</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONSOLA DE CONTROL - Estilo Hacker */}
                <div className="w-full max-w-[340px] relative pointer-events-auto">
                    <div className="bg-black/60 backdrop-blur-3xl border-2 border-white/10 rounded-3xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center justify-between relative group">

                        {/* Brillo Indicador Activo */}
                        <div className={`absolute -inset-1 rounded-3xl blur-2xl opacity-20 transition-all duration-1000 -z-10
                            ${isActive ? 'bg-cyan-500 animate-pulse' : isBreak ? 'bg-yellow-500 animate-pulse' : 'bg-transparent'}
                        `} />

                        {/* BOTONES DE ACCIÓN */}
                        <div className="flex items-center gap-2 flex-1">
                            {/* CLOCK IN */}
                            <button
                                onClick={() => !isActive && !isBreak && employee?.verified && clockIn()}
                                disabled={isActive || isBreak || !employee?.verified}
                                className={`
                                    relative flex-1 h-16 rounded-2xl transition-all duration-300 overflow-hidden flex flex-col items-center justify-center gap-1 group/btn
                                    ${(isIdle && employee?.verified)
                                        ? 'bg-cyan-600 text-black shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:bg-cyan-500 active:scale-[0.95] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]'
                                        : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'}
                                `}
                            >
                                <Play className={`w-5 h-5 fill-current ${!isIdle && 'opacity-20'}`} />
                                <span className="text-[9px] font-black tracking-[0.2em] uppercase">ENTRADA</span>
                                {isIdle && employee?.verified && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500 skew-x-[-20deg]" />}
                            </button>

                            {/* PAUSE / RESUME */}
                            <button
                                onClick={() => isActive ? startBreak('REST') : isBreak ? endBreak() : null}
                                disabled={isIdle}
                                className={`
                                    relative flex-1 h-16 rounded-2xl transition-all duration-300 border-2 flex flex-col items-center justify-center gap-1
                                    ${isActive
                                        ? 'bg-black/40 border-white/10 text-white hover:border-yellow-500/50 hover:text-yellow-400 shadow-inner'
                                        : isBreak
                                            ? 'bg-yellow-500 border-black text-black animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.4)]'
                                            : 'bg-transparent border-transparent text-white/5'}
                                `}
                            >
                                {isBreak ? <Play className="w-5 h-5 fill-current" /> : <Coffee className="w-5 h-5" />}
                                <span className="text-[9px] font-black tracking-[0.2em] uppercase">{isBreak ? 'VOLVER' : 'PAUSA'}</span>
                            </button>

                            {/* CLOCK OUT */}
                            <button
                                onClick={() => (isActive || isBreak) && clockOut()}
                                disabled={isIdle}
                                className={`
                                    relative flex-1 h-16 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-1 border-2
                                    ${(isActive || isBreak)
                                        ? 'bg-black/40 border-red-900 text-red-500 hover:bg-red-600 hover:text-black hover:border-red-500 active:scale-[0.95]'
                                        : 'bg-transparent border-transparent text-white/5'}
                                `}
                            >
                                <Square className="w-5 h-5 fill-current" />
                                <span className="text-[9px] font-black tracking-[0.2em] uppercase">SALIDA</span>
                            </button>
                        </div>

                        {/* SEPARADOR & NAV */}
                        <div className="w-[1px] h-10 bg-white/10 mx-2" />

                        <div className="flex items-center gap-1">
                            <button onClick={handleLocate} className="w-10 h-16 flex items-center justify-center text-white/30 hover:text-cyan-400 transition-colors">
                                <Crosshair className="w-4 h-4" />
                            </button>
                            <button onClick={logout} className="w-10 h-16 flex items-center justify-center text-white/30 hover:text-red-500 transition-colors">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* TELEMETRÍA INFERIOR - Estilo Hacker */}
                <div className="w-full max-w-[320px] flex justify-between items-end pb-2 px-6 py-3 bg-black/60 backdrop-blur-3xl rounded-2xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-[-15px]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-cyan-400 tracking-[0.2em] uppercase drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
                            <MapPin className="w-3 h-3" />
                            COORD_X_Y
                        </div>
                        <div className="text-[10px] font-mono text-white/70 tracking-tighter">
                            {lastKnownLocation ? `${lastKnownLocation.latitude.toFixed(6)}, ${lastKnownLocation.longitude.toFixed(6)}` : 'SCANNING_SIGNAL...'}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4 text-white/10" />
                        <div className="text-right">
                            <div className="text-[9px] font-black text-white/20 tracking-wider uppercase">ACCURACY</div>
                            <div className="text-[10px] font-mono text-cyan-400 font-bold">{lastKnownLocation ? `${lastKnownLocation.accuracy.toFixed(1)}m` : '--'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SCANLINE LAYER */}
            <div className="absolute inset-0 z-50 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]" />

            {/* GRID LAYER (The dots) */}
            <div className="absolute inset-0 z-20 pointer-events-none opacity-[0.15] bg-[radial-gradient(circle,#0ff_0.5px,transparent_0.5px)] bg-[size:40px_40px]" />
        </div>
    );
};

