import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rpc } from '../lib/api';
import { useAuthStore } from './useAuthStore';

export interface Coordinates {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

type Estado = 'idle' | 'active' | 'break' | 'completed';

interface EstadoServidor {
    status: Estado;
    current_shift_id?: string | null;
    current_break_id?: string | null;
    start_time?: string | null;
}

interface TimeState {
    status: Estado;
    currentShiftId: string | null;
    currentBreakId: string | null;
    lastKnownLocation: Coordinates | null;
    startTime: string | null;

    clockIn: () => Promise<void>;
    clockOut: (notes?: string) => Promise<void>;
    startBreak: (reason: string) => Promise<void>;
    endBreak: () => Promise<void>;
    updateLocation: (coords: Coordinates) => void;
    syncStatus: () => Promise<void>;
    reset: () => void;
}

/** El turno se deduce del token en el servidor: el cliente ya no lo elige. */
const token = () => useAuthStore.getState().token;

/** Coordenadas en el formato JSONB que espera la base de datos. */
const comoJson = (c: Coordinates | null) =>
    c ? { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy } : null;

export const useTimeStore = create<TimeState>()(
    persist(
        (set, get) => ({
            status: 'idle',
            currentShiftId: null,
            currentBreakId: null,
            lastKnownLocation: null,
            startTime: null,

            updateLocation: (coords) => set({ lastKnownLocation: coords }),

            reset: () => set({
                status: 'idle', currentShiftId: null, currentBreakId: null, startTime: null,
            }),

            // El servidor es la fuente de verdad del turno abierto.
            syncStatus: async () => {
                if (!token()) return;
                try {
                    const data = await rpc<EstadoServidor>('get_my_status', { p_token: token() });
                    if (!data || data.status === 'idle') {
                        get().reset();
                        return;
                    }
                    set({
                        status: data.status,
                        currentShiftId: data.current_shift_id ?? null,
                        currentBreakId: data.current_break_id ?? null,
                        startTime: data.start_time ?? null,
                    });
                } catch (e) {
                    console.error('Error al sincronizar el estado del turno:', e);
                }
            },

            clockIn: async () => {
                // clock_in es idempotente en servidor: si ya hay turno abierto
                // devuelve ese mismo id en vez de fallar.
                const shiftId = await rpc<string>('clock_in', {
                    p_token: token(),
                    p_location: comoJson(get().lastKnownLocation),
                });

                set({
                    status: 'active',
                    currentShiftId: shiftId,
                    currentBreakId: null,
                    startTime: new Date().toISOString(),
                });
            },

            clockOut: async (notes) => {
                // También idempotente: si el turno ya estaba cerrado, no es error.
                await rpc<void>('clock_out', {
                    p_token: token(),
                    p_location: comoJson(get().lastKnownLocation),
                    p_notes: notes ?? null,
                });

                get().reset();
            },

            startBreak: async (reason) => {
                const breakId = await rpc<string>('start_break', {
                    p_token: token(),
                    p_reason: reason,
                });
                set({ status: 'break', currentBreakId: breakId });
            },

            endBreak: async () => {
                await rpc<void>('end_break', { p_token: token() });
                set({ status: 'active', currentBreakId: null });
            },
        }),
        {
            name: 'time-storage',
        }
    )
);
