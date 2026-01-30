import { useEffect, useRef, useState } from 'react';
import { Play, Square, LogOut, Coffee, Crosshair, MapPin, Clock, Shield, AlertTriangle, Monitor } from 'lucide-react';
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
                    {/* Main Identity Terminal */}
                    <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 relative overflow-hidden group min-w-[320px]">
                        {/* Status Accent Glow */}
                        <div
                            className={`absolute top-0 left-0 w-1 h-full shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors duration-500
                                ${isActive ? 'bg-cyan-500 shadow-[0_0_10px_#06b6d4]' : isBreak ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-gray-700'}
                             `}
                        />

                        {/* Avatar Hub */}
                        <div className="relative shrink-0">
                            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-xl font-black text-white overflow-hidden transition-all duration-500 rotate-1 group-hover:rotate-0
                                ${isActive ? 'bg-cyan-900/30 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : isBreak ? 'bg-yellow-900/30 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-black border-white/10'}
                            `}>
                                {employee?.avatar_url ? (
                                    <img src={employee.avatar_url} className="w-full h-full object-cover" alt="User" />
                                ) : (
                                    employee?.first_name?.charAt(0)
                                )}
                            </div>
                            {isActive && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-cyan-500 border-2 border-black rounded-full animate-pulse shadow-[0_0_8px_#06b6d4]" />}
                        </div>

                        {/* Text Metrics */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-black tracking-wider text-sm uppercase">[{employee?.first_name}]</span>
                                {employee?.verified ? (
                                    <Shield className="w-3 h-3 text-cyan-500 opacity-60" />
                                ) : (
                                    <AlertTriangle className="w-3 h-3 text-yellow-500 animate-pulse" />
                                )}
                            </div>
                            <div className="h-4 flex items-center mt-1">
                                <AnimatePresence mode="wait">
                                    {isActive ? (
                                        <motion.div
                                            key="status-active"
                                            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }}
                                            className="text-[10px] font-black text-cyan-400 tracking-[0.2em] flex items-center gap-2"
                                        >
                                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                                            DEPLOYED // {formattedStartTime}
                                        </motion.div>
                                    ) : isBreak ? (
                                        <motion.div
                                            key="status-break"
                                            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }}
                                            className="text-[10px] font-black text-yellow-400 tracking-[0.2em]"
                                        >
                                            STANDBY MODE
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="status-idle"
                                            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }}
                                            className="text-[10px] font-black text-white/30 tracking-[0.2em]"
                                        >
                                            SYSTEM OFFLINE
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Secondary Metric */}
                        <div className="pl-4 border-l border-white/5 flex flex-col items-center">
                            <Clock className="w-4 h-4 text-white/20 mb-1" />
                            <span className="text-[9px] font-mono text-white/40">GMT-5</span>
                        </div>
                    </div>

                    {/* Unverified Warning Tooltip */}
                    {!employee?.verified && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-red-500/10 backdrop-blur-md border border-red-500/20 rounded-xl p-3 flex items-start gap-3 max-w-[320px]"
                        >
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-red-500 tracking-widest uppercase">Unauthorized Access</p>
                                <p className="text-[9px] text-white/60 leading-tight">Tu perfil está pendiente de validación. Las funciones de registro están bloqueadas.</p>
                            </div>
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
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <span className="text-[10px] font-black text-cyan-500/50 tracking-[0.5em] uppercase">Session Termination</span>
                            <div className="text-5xl font-mono text-cyan-400 font-black tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                                T-{timeLeft.toString().padStart(2, '0')}:00
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONTROL CONSOLE */}
                <div className="w-full max-w-[450px] relative pointer-events-auto">
                    {/* High-End Glass Console */}
                    <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 shadow-2xl flex items-center justify-between relative group">

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
                                        : 'bg-white/5 text-white/10 cursor-not-allowed'}
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
                                        ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                        : isBreak
                                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 animate-pulse'
                                            : 'bg-transparent border-transparent text-white/5'}
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
                                        ? 'bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 active:scale-[0.98]'
                                        : 'bg-transparent text-white/5'}
                                `}
                            >
                                <Square className="w-6 h-6 fill-current" />
                                <span className="text-[9px] font-black tracking-[0.3em] uppercase">Abort</span>
                            </button>
                        </div>

                        {/* SEPARATOR & NAV */}
                        <div className="w-[1px] h-12 bg-white/10 mx-2 md:mx-4" />

                        <div className="flex items-center gap-1">
                            <button onClick={handleLocate} className="w-12 h-20 flex items-center justify-center text-white/20 hover:text-cyan-500 transition-colors">
                                <Crosshair className="w-5 h-5" />
                            </button>
                            <button onClick={logout} className="w-12 h-20 flex items-center justify-center text-white/20 hover:text-red-500 transition-colors">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* BOTTOM TELEMETRY */}
                <div className="w-full max-w-[450px] flex justify-between items-end pb-2 opacity-40">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[8px] font-black text-white tracking-[0.3em] uppercase">
                            <MapPin className="w-2.5 h-2.5" />
                            Location Context
                        </div>
                        <div className="text-[9px] font-mono text-cyan-500">
                            {lastKnownLocation ? `${lastKnownLocation.latitude.toFixed(6)}, ${lastKnownLocation.longitude.toFixed(6)}` : 'SCANNING...'}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4 text-white/20" />
                        <div className="text-right">
                            <div className="text-[8px] font-black text-white/50 tracking-[0.2em] uppercase">Accuracy</div>
                            <div className="text-[9px] font-mono text-white/30">{lastKnownLocation ? `${lastKnownLocation.accuracy.toFixed(1)}m` : '--'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* GRID LAYER (The dots) */}
            <div className="absolute inset-0 z-20 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
    );
};
