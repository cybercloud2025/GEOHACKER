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
        <div className="relative h-screen flex flex-col overflow-hidden bg-black font-sans selection:bg-cyan-500/30">

            {/* MAP LAYER (Full screen background) */}
            <div className="absolute inset-0 z-0 grayscale-[0.5] contrast-[1.2] brightness-[0.7]">
                <GoogleMapWrapper>
                    <TrackerMapGoogle center={mapCenter} />
                </GoogleMapWrapper>
            </div>

            {/* VIGNETTE OVERLAY */}
            <div className="absolute inset-0 bg-radial-vignette pointer-events-none z-10" />

            {/* TOP BAR / SYSTEM INFO */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 md:p-6 flex flex-col items-start pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4 pointer-events-auto"
                >
                    {/* Main Identity Terminal - HUD Style */}
                    <div className="bg-[#0a0a0a]/90 backdrop-blur-3xl border-2 border-cyan-500/40 rounded-3xl p-5 shadow-[0_0_40px_rgba(6,182,212,0.25)] flex items-center gap-5 relative overflow-hidden group min-w-[340px]">
                        {/* Status Accent Glow (Dynamic Side) */}
                        <div
                            className={`absolute top-0 right-0 w-1.5 h-full transition-all duration-700
                                ${isActive ? 'bg-cyan-500 shadow-[-5px_0_20px_#06b6d4]' : isBreak ? 'bg-yellow-500 shadow-[-5px_0_20px_#eab308]' : 'bg-red-500 shadow-[-5px_0_20px_#ef4444]'}
                             `}
                        />

                        {/* Scanning Line Animation */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-12 w-full animate-scan pointer-events-none" />

                        {/* Avatar Hub with Circular HUD Border */}
                        <div className="relative shrink-0 p-1">
                            <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-black text-white overflow-hidden transition-all duration-500 shadow-[0_0_20px_rgba(0,0,0,0.5)]
                                ${isActive ? 'bg-cyan-900/40 border-cyan-400' : isBreak ? 'bg-yellow-900/40 border-yellow-400' : 'bg-red-900/40 border-red-400'}
                            `}>
                                {employee?.avatar_url ? (
                                    <img src={employee.avatar_url} className="w-full h-full object-cover" alt="User" />
                                ) : (
                                    employee?.first_name?.charAt(0)
                                )}
                            </div>
                            {isActive && <div className="absolute top-0 right-0 w-5 h-5 bg-cyan-500 border-4 border-[#0a0a0a] rounded-full animate-pulse shadow-[0_0_10px_#06b6d4]" />}
                        </div>

                        {/* Text Metrics - High Visibility */}
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-black tracking-[0.15em] text-lg uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{employee?.first_name} {employee?.last_name}</span>
                                {employee?.verified ? (
                                    <div className="px-2 py-0.5 bg-cyan-500/20 rounded-md border border-cyan-500/30">
                                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                                    </div>
                                ) : (
                                    <div className="px-2 py-0.5 bg-red-500/20 rounded-md border border-red-500/30 animate-pulse">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <AnimatePresence mode="wait">
                                    {isActive ? (
                                        <motion.div
                                            key="status-active"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-cyan-500/10 rounded-full border border-cyan-500/20 text-[9px] font-black text-cyan-400 tracking-widest flex items-center gap-2"
                                        >
                                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                                            UNIDAD ACTIVA // {formattedStartTime}
                                        </motion.div>
                                    ) : isBreak ? (
                                        <motion.div
                                            key="status-break"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/20 text-[9px] font-black text-yellow-500 tracking-widest"
                                        >
                                            PROTOCOLO RECESO
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="status-idle"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/20 text-[9px] font-black text-red-500 tracking-widest"
                                        >
                                            DESCONECTADO
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div className="text-[9px] font-mono text-white/30">GMT-5</div>
                            </div>
                        </div>
                    </div>

                    {/* Alerta de Verificación - Más compacta */}
                    {!employee?.verified && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-red-500/20 backdrop-blur-md border border-red-500/40 rounded-xl p-2 flex items-start gap-2 max-w-[280px]"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 animate-pulse" />
                            <p className="text-[9px] text-white/80 leading-tight font-medium">Acceso no verificado. Funciones bloqueadas.</p>
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* --- BOTTOM OPERATIONAL CENTER --- */}
            <div className="absolute bottom-0 left-0 right-0 z-40 p-6 md:p-12 flex flex-col items-center gap-8 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">

                {/* IDLE TIMER (When logout is imminent) */}
                <AnimatePresence>
                    {isIdle && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex flex-col items-center gap-0.5 bg-[#0a0a0a]/95 backdrop-blur-3xl px-10 py-5 rounded-[32px] border-2 border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.3)] mb-4 relative"
                        >
                            <span className="text-[11px] font-black text-cyan-400 tracking-[0.5em] uppercase">CIERRE DE SESIÓN</span>
                            <div className="text-6xl font-mono text-white font-black tracking-tighter drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
                                {timeLeft}
                            </div>
                            <span className="text-[9px] font-mono text-cyan-500/60 uppercase tracking-widest">Segundos Restantes</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONTROL CONSOLE */}
                <div className="w-full max-w-[450px] relative pointer-events-auto">
                    {/* High-End Glass Console - HUD DESIGN */}
                    <div className="bg-[#0a0a0a]/95 backdrop-blur-3xl border-2 border-cyan-500/50 rounded-[40px] p-2.5 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex items-center justify-between relative group">

                        {/* Active Indicator Glow */}
                        <div className={`absolute -inset-2 rounded-[40px] blur-2xl opacity-10 transition-colors duration-700 -z-10
                            ${isActive ? 'bg-cyan-500' : isBreak ? 'bg-yellow-500' : 'bg-transparent'}
                        `} />

                        {/* ACTION BUTTONS */}
                        <div className="flex items-center gap-2 flex-1">
                            {/* CLOCK IN */}
                            <button
                                onClick={() => !isActive && !isBreak && employee?.verified && clockIn()}
                                disabled={isActive || isBreak || !employee?.verified}
                                className={`
                                    relative flex-1 group/btn h-20 rounded-2xl transition-all duration-300 overflow-hidden flex flex-col items-center justify-center gap-1
                                    ${(isIdle && employee?.verified)
                                        ? 'bg-gradient-to-br from-cyan-600 to-cyan-900 text-white shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:brightness-110 active:scale-[0.98]'
                                        : 'bg-white/5 text-white/40 cursor-not-allowed'}
                                `}
                            >
                                <Play className={`w-6 h-6 fill-current transition-transform group-hover/btn:scale-110 ${!isIdle && 'opacity-20'}`} />
                                <span className="text-[9px] font-black tracking-[0.3em] uppercase">Engage</span>
                                {isIdle && employee?.verified && (
                                    <motion.div
                                        animate={{ x: [-100, 200] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 bg-white/20 skew-x-[30deg] w-12 pointer-events-none"
                                    />
                                )}
                            </button>

                            {/* PAUSE / RESUME */}
                            <button
                                onClick={() => isActive ? startBreak('REST') : isBreak ? endBreak() : null}
                                disabled={isIdle}
                                className={`
                                    relative flex-1 group/btn h-20 rounded-2xl transition-all duration-300 border flex flex-col items-center justify-center gap-1
                                    ${isActive
                                        ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                                        : isBreak
                                            ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500 animate-pulse'
                                            : 'bg-transparent border-transparent text-white/10'}
                                `}
                            >
                                {isBreak ? <Play className="w-6 h-6 fill-current" /> : <Coffee className="w-6 h-6" />}
                                <span className="text-[9px] font-black tracking-[0.3em] uppercase">{isBreak ? 'Resume' : 'Pause'}</span>
                            </button>

                            {/* CLOCK OUT */}
                            <button
                                onClick={() => (isActive || isBreak) && clockOut()}
                                disabled={isIdle}
                                className={`
                                    relative flex-1 group/btn h-20 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-1
                                    ${(isActive || isBreak)
                                        ? 'bg-red-500/20 border border-red-500/40 text-red-500 hover:bg-red-500/30 active:scale-[0.98]'
                                        : 'bg-transparent text-white/10'}
                                `}
                            >
                                <Square className="w-6 h-6 fill-current" />
                                <span className="text-[9px] font-black tracking-[0.3em] uppercase">Abort</span>
                            </button>
                        </div>

                        {/* SEPARADOR & NAV */}
                        <div className="w-[1px] h-10 bg-white/10 mx-2" />

                        <div className="flex items-center gap-1">
                            <button onClick={handleLocate} className="w-10 h-16 flex items-center justify-center text-white/20 hover:text-cyan-500 transition-colors">
                                <Crosshair className="w-4 h-4" />
                            </button>
                            <button onClick={logout} className="w-10 h-16 flex items-center justify-center text-white/20 hover:text-red-500 transition-colors">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* BOTTOM TELEMETRY - HUD DESIGN */}
                <div className="w-full max-w-[400px] flex justify-between items-end pb-1 px-6 py-3 bg-[#0a0a0a]/95 backdrop-blur-3xl rounded-2xl border-2 border-cyan-500/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] mt-[-15px]">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-[9px] font-black text-cyan-400 tracking-[0.2em] uppercase">
                            <MapPin className="w-2.5 h-2.5" />
                            UBICACIÓN
                        </div>
                        <div className="text-[10px] font-mono text-white/80 tracking-tight">
                            {lastKnownLocation ? `${lastKnownLocation.latitude.toFixed(6)}, ${lastKnownLocation.longitude.toFixed(6)}` : 'ESCANEANDO...'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Monitor className="w-3 h-3 text-white/20" />
                        <div className="text-right">
                            <div className="text-[9px] font-black text-white/40 tracking-[0.1em] uppercase">PRECISIÓN</div>
                            <div className="text-[10px] font-mono text-cyan-400">{lastKnownLocation ? `${lastKnownLocation.accuracy.toFixed(1)}m` : '--'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* GRID LAYER (The dots) */}
            <div className="absolute inset-0 z-20 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
    );
};
