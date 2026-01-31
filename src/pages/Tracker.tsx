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

        const successHandler = (pos: GeolocationPosition) => {
            const newCoords = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp
            };
            updateLocation(newCoords);
        };

        const errorHandler = (_err: GeolocationPositionError) => {
            navigator.geolocation.getCurrentPosition(
                successHandler,
                () => { },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
            );
        };

        navigator.geolocation.getCurrentPosition(
            successHandler,
            errorHandler,
            { enableHighAccuracy: true, timeout: 5000 }
        );
    };

    useEffect(() => {
        syncStatus();
        handleLocate();
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
        <div className="relative h-screen flex flex-col overflow-hidden bg-slate-50 font-sans selection:bg-cyan-500/20">

            {/* MAP LAYER (Full screen background) - Light & Sharp */}
            <div className="absolute inset-0 z-0">
                <GoogleMapWrapper>
                    <TrackerMapGoogle center={mapCenter} />
                </GoogleMapWrapper>
            </div>

            {/* NO OVERLAYS - CLEAN MAP */}

            {/* TOP BAR / SYSTEM INFO */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 md:p-6 flex flex-col items-start pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4 pointer-events-auto"
                >
                    {/* Main Identity Terminal - Light HUD Style */}
                    <div className="bg-white/90 backdrop-blur-3xl border border-slate-200 rounded-2xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] flex items-center gap-4 relative overflow-hidden group min-w-[300px]">
                        {/* Status Accent Glow (Dynamic Side) */}
                        <div
                            className={`absolute top-0 right-0 w-1.5 h-full transition-all duration-700
                                ${isActive ? 'bg-cyan-500 shadow-[-2px_0_10px_rgba(6,182,212,0.4)]' : isBreak ? 'bg-yellow-500' : 'bg-red-500 outline outline-1 outline-red-200'}
                             `}
                        />

                        <div className="relative shrink-0">
                            <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl font-black transition-all duration-500 shadow-sm
                                ${isActive ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : isBreak ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'}
                            `}>
                                {employee?.avatar_url ? (
                                    <img src={employee.avatar_url} className="w-full h-full object-cover" alt="User" />
                                ) : (
                                    employee?.first_name?.charAt(0)
                                )}
                            </div>
                            {isActive && <div className="absolute top-0 right-0 w-4 h-4 bg-cyan-500 border-2 border-white rounded-full animate-pulse shadow-sm" />}
                        </div>

                        {/* Text Metrics */}
                        <div className="flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-900 font-bold tracking-tight text-base uppercase">{employee?.first_name} {employee?.last_name}</span>
                                {employee?.verified ? (
                                    <Shield className="w-3.5 h-3.5 text-cyan-600" />
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
                                            className="px-2 py-0.5 bg-cyan-50 rounded-full border border-cyan-100 text-[8px] font-bold text-cyan-700 tracking-widest flex items-center gap-1.5"
                                        >
                                            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
                                            CONECTADO // {formattedStartTime}
                                        </motion.div>
                                    ) : isBreak ? (
                                        <motion.div
                                            key="status-break"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-yellow-50 rounded-full border border-yellow-100 text-[8px] font-bold text-yellow-700 tracking-widest uppercase"
                                        >
                                            EN RECESO
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="status-idle"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-red-50 rounded-full border border-red-100 text-[8px] font-bold text-red-700 tracking-widest uppercase"
                                        >
                                            DESCONECTADO
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div className="text-[8px] font-mono text-slate-400 font-medium tracking-tight">GMT-5</div>
                            </div>
                        </div>
                    </div>

                    {/* Alerta de Verificación - Light Style */}
                    {!employee?.verified && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-red-50 backdrop-blur-md border border-red-100 rounded-xl p-2 flex items-center gap-2 max-w-[260px] shadow-sm"
                        >
                            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 animate-pulse" />
                            <p className="text-[9px] text-red-800 leading-none font-bold uppercase tracking-tighter">Perfil No Validado</p>
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* --- BOTTOM OPERATIONAL CENTER --- */}
            <div className="absolute bottom-0 left-0 right-0 z-40 p-6 md:p-12 flex flex-col items-center gap-8 pointer-events-none">

                {/* IDLE TIMER - Light Style */}
                <AnimatePresence>
                    {isIdle && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center bg-white/95 backdrop-blur-xl px-8 py-4 rounded-2xl border border-slate-200 shadow-[0_12px_40px_rgba(0,0,0,0.15)] mb-4 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400" />
                            <span className="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase mb-1">Cierre de Sesión</span>
                            <div className="text-5xl font-mono text-slate-900 font-bold tracking-tight mb-1">
                                {timeLeft.toString().padStart(2, '0')}
                            </div>
                            <span className="text-[8px] font-bold text-cyan-600 uppercase tracking-widest">Segundos Restantes</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONTROL CONSOLE - Light Style */}
                <div className="w-full max-w-[340px] relative pointer-events-auto">
                    <div className="bg-white/95 backdrop-blur-3xl border border-slate-200 rounded-3xl p-2 shadow-[0_10px_30px_rgba(0,0,0,0.1)] flex items-center justify-between relative group">

                        {/* Active Indicator Glow */}
                        <div className={`absolute -inset-1 rounded-3xl blur-xl opacity-10 transition-colors duration-700 -z-10
                            ${isActive ? 'bg-cyan-500' : isBreak ? 'bg-yellow-500' : 'bg-transparent'}
                        `} />

                        {/* ACTION BUTTONS */}
                        <div className="flex items-center gap-1.5 flex-1">
                            {/* CLOCK IN */}
                            <button
                                onClick={() => !isActive && !isBreak && employee?.verified && clockIn()}
                                disabled={isActive || isBreak || !employee?.verified}
                                className={`
                                    relative flex-1 h-14 rounded-xl transition-all duration-300 overflow-hidden flex flex-col items-center justify-center gap-0.5
                                    ${(isIdle && employee?.verified)
                                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-200 hover:bg-cyan-600 active:scale-[0.98]'
                                        : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'}
                                `}
                            >
                                <Play className={`w-5 h-5 fill-current ${!isIdle && 'opacity-20'}`} />
                                <span className="text-[8px] font-bold tracking-widest uppercase">Iniciar</span>
                            </button>

                            {/* PAUSE / RESUME */}
                            <button
                                onClick={() => isActive ? startBreak('REST') : isBreak ? endBreak() : null}
                                disabled={isIdle}
                                className={`
                                    relative flex-1 h-14 rounded-xl transition-all duration-300 border flex flex-col items-center justify-center gap-0.5
                                    ${isActive
                                        ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        : isBreak
                                            ? 'bg-yellow-50 border-yellow-200 text-yellow-600 animate-pulse'
                                            : 'bg-transparent border-transparent text-slate-200'}
                                `}
                            >
                                {isBreak ? <Play className="w-5 h-5 fill-current" /> : <Coffee className="w-5 h-5" />}
                                <span className="text-[8px] font-bold tracking-widest uppercase">{isBreak ? 'Reanudar' : 'Pausar'}</span>
                            </button>

                            {/* CLOCK OUT */}
                            <button
                                onClick={() => (isActive || isBreak) && clockOut()}
                                disabled={isIdle}
                                className={`
                                    relative flex-1 h-14 rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-0.5 border
                                    ${(isActive || isBreak)
                                        ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                        : 'bg-transparent border-transparent text-slate-200'}
                                `}
                            >
                                <Square className="w-5 h-5 fill-current" />
                                <span className="text-[8px] font-bold tracking-widest uppercase">Detener</span>
                            </button>
                        </div>

                        {/* SEPARADOR & NAV */}
                        <div className="w-[1px] h-10 bg-slate-100 mx-1" />

                        <div className="flex items-center gap-0">
                            <button onClick={handleLocate} className="w-8 h-14 flex items-center justify-center text-slate-400 hover:text-cyan-500 transition-colors">
                                <Crosshair className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={logout} className="w-8 h-14 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* BOTTOM TELEMETRY - Light Style */}
                <div className="w-full max-w-[320px] flex justify-between items-end pb-1.5 px-6 py-2 bg-white/95 backdrop-blur-3xl rounded-xl border border-slate-200 shadow-[0_8px_25px_rgba(0,0,0,0.08)] mt-[-12px]">
                    <div className="flex flex-col gap-0">
                        <div className="flex items-center gap-1.5 text-[8px] font-bold text-cyan-600 tracking-wider uppercase">
                            <MapPin className="w-2.5 h-2.5" />
                            UBICACIÓN
                        </div>
                        <div className="text-[9px] font-mono text-slate-800 tracking-tight font-medium">
                            {lastKnownLocation ? `${lastKnownLocation.latitude.toFixed(6)}, ${lastKnownLocation.longitude.toFixed(6)}` : 'ESPERANDO...'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Monitor className="w-3 h-3 text-slate-300" />
                        <div className="text-right">
                            <div className="text-[8px] font-bold text-slate-400 tracking-wider uppercase">PRECISIÓN</div>
                            <div className="text-[9px] font-mono text-cyan-600 font-bold">{lastKnownLocation ? `${lastKnownLocation.accuracy.toFixed(1)}m` : '--'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* GRID LAYER (The dots) - Adjusted for light theme */}
            <div className="absolute inset-0 z-20 pointer-events-none opacity-[0.05] bg-[radial-gradient(circle,#000_0.5px,transparent_0.5px)] bg-[size:30px_30px]" />
        </div>
    );
};
