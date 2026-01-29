import { useEffect, useRef, useState } from 'react';
import { Play, Square, LogOut, Coffee, Crosshair } from 'lucide-react';

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
        if (!navigator.geolocation) {
            alert('Geolocalización no soportada');
            return;
        }

        const successHandler = (pos: GeolocationPosition) => {
            const newCoords = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp
            };
            updateLocation(newCoords);
        };

        const errorHandler = (err: GeolocationPositionError) => {
            console.warn("High accuracy failed, trying low accuracy...", err);
            navigator.geolocation.getCurrentPosition(
                successHandler,
                (finalErr) => {
                    console.error("Geolocation failed:", finalErr);
                    alert("⚠️ No pudimos obtener tu ubicación.\n\nAsegúrate de permitir el acceso a la ubicación en tu navegador.");
                },
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
        <div className="relative h-screen flex flex-col overflow-hidden bg-gray-900 font-sans">

            {/* MAP BACKGROUND */}
            <div className="absolute inset-0 z-0">
                <GoogleMapWrapper>
                    <TrackerMapGoogle center={mapCenter} />
                </GoogleMapWrapper>
            </div>

            {/* --- TOP STATUS CARD --- */}
            <div className="absolute top-6 left-6 right-6 z-20 flex justify-center md:justify-start pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 min-w-[300px] pointer-events-auto relative overflow-hidden">
                    {/* Status Color Line */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1 ${isActive ? 'bg-cyan-500' : isBreak ? 'bg-yellow-500' : 'bg-gray-500'}`} />

                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold text-white shadow-lg overflow-hidden ${isActive ? 'bg-cyan-900/50 border-cyan-500' : isBreak ? 'bg-yellow-900/50 border-yellow-500' : 'bg-gray-800 border-gray-600'}`}>
                            {employee?.avatar_url ? (
                                <img
                                    src={employee.avatar_url}
                                    alt={employee.first_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Fallback if image fails to load
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).parentElement!.innerText = employee?.first_name?.charAt(0) || '';
                                    }}
                                />
                            ) : (
                                employee?.first_name?.charAt(0)
                            )}
                        </div>
                        {isActive && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse" />}
                    </div>

                    {/* Info */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-white font-bold text-lg leading-tight">{employee?.first_name} {employee?.last_name}</h2>
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-widest border transition-all duration-500 ${employee?.verified ? 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.2)]' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.2)]'}`}>
                                {employee?.verified ? 'Verificado' : 'Temporal'}
                            </span>
                        </div>

                        {!employee?.verified && (
                            <div className="flex flex-col gap-1.5 mt-2 p-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg backdrop-blur-sm">
                                <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                                    ESTADO: VERIFICACIÓN PENDIENTE
                                </p>
                                <p className="text-white/60 text-[9px] leading-tight max-w-[220px] font-medium">
                                    Tu acceso está en modo <span className="text-yellow-500/80 font-bold">LECTURA</span>. Solicita a un administrador que valide tu perfil para desbloquear el sistema de fichaje.
                                </p>
                            </div>
                        )}

                        {isActive && (
                            <p className="text-cyan-400 text-xs uppercase font-bold tracking-wide flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                En Turno - Desde {formattedStartTime}
                            </p>
                        )}
                        {isBreak && (
                            <p className="text-yellow-400 text-xs uppercase font-bold tracking-wide flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                En Pausa
                            </p>
                        )}
                        {isIdle && (
                            <div className="flex flex-col">
                                <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">
                                    Fuera de Turno
                                </p>
                                <p className="text-[#39FF14] text-xl font-mono animate-pulse font-black mt-1 drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]">
                                    Cierre en: {timeLeft}s
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Locate Button (Integrated in Card) */}
                    <button onClick={handleLocate} className="ml-auto p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                        <Crosshair className="w-5 h-5" />
                    </button>
                </div>
            </div>


            {/* --- BOTTOM CONTROL PANEL --- */}
            <div className="absolute bottom-8 left-0 right-0 z-20 px-6 flex justify-center">
                <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center gap-2 relative">

                    {/* Glow Effect based on status */}
                    <div className={`absolute inset-0 rounded-3xl -z-10 opacity-20 blur-xl transition-colors duration-500 ${isActive ? 'bg-cyan-500' : isBreak ? 'bg-yellow-500' : (!employee?.verified && isIdle) ? 'bg-yellow-500/40' : 'bg-transparent'}`} />

                    {/* PLAY BUTTON (Start) */}
                    <button
                        onClick={() => !isActive && !isBreak && employee?.verified && clockIn()}
                        disabled={isActive || isBreak || !employee?.verified}
                        className={`
                            flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300
                            ${(isIdle && employee?.verified)
                                ? 'bg-gradient-to-b from-green-600 to-green-800 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:scale-105 active:scale-95'
                                : 'bg-gray-800/50 text-gray-600 opacity-50 cursor-not-allowed group relative'}
                        `}
                        title={!employee?.verified ? "Cuenta pendiente de verificación" : ""}
                    >
                        <Play className={`w-8 h-8 fill-current mb-1 ${!employee?.verified ? 'text-yellow-600/50' : ''}`} />
                        <span className="text-[9px] font-black uppercase tracking-wider">Entrar</span>
                        {!employee?.verified && isIdle && (
                            <div className="absolute -top-1 -right-1">
                                <span className="flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500 border border-black"></span>
                                </span>
                            </div>
                        )}
                    </button>

                    {/* PAUSE BUTTON */}
                    <button
                        onClick={() => isActive ? startBreak('Rest') : isBreak ? endBreak() : null}
                        disabled={isIdle}
                        className={`
                            flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300
                            ${isActive
                                ? 'bg-gradient-to-b from-yellow-500 to-yellow-700 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:scale-105 active:scale-95'
                                : isBreak
                                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 animate-pulse'
                                    : 'bg-gray-800/50 text-gray-600 opacity-50 cursor-not-allowed'}
                        `}
                    >
                        {isBreak ? <Play className="w-8 h-8 fill-current mb-1" /> : <Coffee className="w-8 h-8 mb-1" />}
                        <span className="text-[9px] font-black uppercase tracking-wider">{isBreak ? 'Volver' : 'Pausa'}</span>
                    </button>

                    {/* STOP BUTTON (End) */}
                    <button
                        onClick={() => (isActive || isBreak) && clockOut()}
                        disabled={isIdle}
                        className={`
                            flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300
                            ${(isActive || isBreak)
                                ? 'bg-gradient-to-b from-red-600 to-red-900 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95'
                                : 'bg-gray-800/50 text-gray-600 opacity-50 cursor-not-allowed'}
                        `}
                    >
                        <Square className="w-8 h-8 fill-current mb-1" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Salir</span>
                    </button>

                    {/* SEPARATOR */}
                    <div className="w-px h-12 bg-white/10 mx-2" />

                    {/* LOGOUT (Small) */}
                    <button
                        onClick={logout}
                        className="flex flex-col items-center justify-center w-14 h-20 rounded-2xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                        <LogOut className="w-6 h-6 mb-1" />
                        <span className="text-[8px] font-bold uppercase">Cerrar</span>
                    </button>

                </div>
            </div>

            {/* FOOTER INFO - Minimally visible */}
            {lastKnownLocation && (
                <div className="absolute bottom-1 left-2 z-10 text-[9px] text-white/30 font-mono pointer-events-none">
                    GPS: {lastKnownLocation.accuracy.toFixed(0)}m
                </div>
            )}

        </div>
    );
};
