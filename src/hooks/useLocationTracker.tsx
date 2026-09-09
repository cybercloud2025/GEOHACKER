import { useEffect, useRef, useState } from 'react';
import { useTimeStore } from '../stores/useTimeStore';
import { useAuthStore } from '../stores/useAuthStore';
import { rpc } from '../lib/api';

const GPS_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
};

/** Distancia mínima recorrida para guardar un punto nuevo. */
const MIN_DISTANCIA_METROS = 10;
/** Aunque no haya movimiento, se guarda un punto cada tanto. */
const MAX_SILENCIO_MS = 2 * 60 * 1000;

function distanciaEnMetros(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // radio terrestre en metros
    const dLat = gradosARadianes(lat2 - lat1);
    const dLon = gradosARadianes(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(gradosARadianes(lat1)) * Math.cos(gradosARadianes(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function gradosARadianes(deg: number) {
    return deg * (Math.PI / 180);
}

interface BatteryManager {
    level: number;
}

/** Nivel de batería real (0-100) o null si el navegador no lo expone. */
async function nivelBateria(): Promise<number | null> {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (typeof nav.getBattery !== 'function') return null;
    try {
        const bat = await nav.getBattery();
        return Math.round(bat.level * 100);
    } catch {
        return null;
    }
}

interface PuntoEnviado {
    latitude: number;
    longitude: number;
    enviadoEn: number;
}

export const useLocationTracker = () => {
    const status = useTimeStore((s) => s.status);
    const updateLocation = useTimeStore((s) => s.updateLocation);
    const token = useAuthStore((s) => s.token);

    const watchId = useRef<number | null>(null);
    const [errorGps, setErrorGps] = useState(false);

    /**
     * Última posición REALMENTE enviada a la base de datos.
     *
     * Antes el filtro de distancia se comparaba contra `lastKnownLocation`, que
     * se actualizaba en cada lectura del GPS. Con alguien caminando despacio la
     * distancia entre lecturas consecutivas nunca superaba los 10 m, así que no
     * se guardaba ningún punto en todo el turno.
     */
    const ultimoEnviado = useRef<PuntoEnviado | null>(null);

    // El turno lo resuelve el servidor a partir del token, así que el hook solo
    // necesita saber si hay que estar escuchando el GPS.
    const tokenRef = useRef(token);
    useEffect(() => { tokenRef.current = token; }, [token]);

    useEffect(() => {
        if (status !== 'active' || !('geolocation' in navigator)) {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
            ultimoEnviado.current = null;
            return;
        }

        watchId.current = navigator.geolocation.watchPosition(
            async (position) => {
                setErrorGps(false);

                const { latitude, longitude, accuracy, heading, speed } = position.coords;
                updateLocation({ latitude, longitude, accuracy, timestamp: position.timestamp });

                const anterior = ultimoEnviado.current;
                const ahora = Date.now();

                const hayQueEnviar =
                    !anterior ||
                    ahora - anterior.enviadoEn > MAX_SILENCIO_MS ||
                    distanciaEnMetros(anterior.latitude, anterior.longitude, latitude, longitude)
                        > MIN_DISTANCIA_METROS;

                if (!hayQueEnviar || !tokenRef.current) return;

                try {
                    await rpc<void>('record_location', {
                        p_token: tokenRef.current,
                        p_latitude: latitude,
                        p_longitude: longitude,
                        p_accuracy: accuracy ?? null,
                        p_heading: heading ?? null,
                        p_speed: speed ?? null,
                        p_battery: await nivelBateria(),
                    });
                    ultimoEnviado.current = { latitude, longitude, enviadoEn: ahora };
                } catch (error) {
                    console.error('No se pudo guardar la ubicación:', error);
                }
            },
            (error) => {
                console.error('Error de geolocalización:', error);
                setErrorGps(true);
            },
            GPS_OPTIONS
        );

        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
        };
    }, [status, updateLocation]);

    return { isTracking: status === 'active' && !errorGps };
};
