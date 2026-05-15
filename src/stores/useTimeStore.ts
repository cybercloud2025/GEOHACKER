import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

interface Coordinates {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

interface TimeState {
    status: 'idle' | 'active' | 'break' | 'completed';
    currentShiftId: string | null;
    currentBreakId: string | null;
    lastKnownLocation: Coordinates | null;
    startTime: string | null;

    // Actions
    clockIn: () => Promise<void>;
    clockOut: (notes?: string) => Promise<void>;
    startBreak: (reason: string) => Promise<void>;
    endBreak: () => Promise<void>;
    updateLocation: (coords: Coordinates) => void;
    syncStatus: () => Promise<void>;
}

export const useTimeStore = create<TimeState>()(
    persist(
        (set, get) => ({
            status: 'idle',
            currentShiftId: null,
            currentBreakId: null,
            lastKnownLocation: null,
            startTime: null,

            updateLocation: (coords) => set({ lastKnownLocation: coords }),

            syncStatus: async () => {
                const { employee } = useAuthStore.getState();
                if (!employee) return;

                const { data } = await supabase
                    .rpc('get_active_shift', { p_employee_id: employee.id });

                if (data) {
                    set({
                        status: data.status as 'active' | 'break',
                        currentShiftId: data.id,
                        startTime: data.start_time
                    });
                }
            },

            clockIn: async () => {
                const { employee } = useAuthStore.getState();
                if (!employee) throw new Error('No employee logged in');

                const location = get().lastKnownLocation;

                try {
                    const { data: shiftId, error } = await supabase.rpc('clock_in', {
                        p_employee_id: employee.id,
                        p_location: location
                    });

                    if (error) {
                        // SMART RECOVERY: If DB says we are already active, sync local state
                        if (error.message && error.message.includes('already has an active shift')) {

                            set({ status: 'active' });
                            // We don't have the ID, but clockOut handles it by employee_id, so it's fine.
                            return;
                        }
                        throw error;
                    }

                    set({
                        status: 'active',
                        currentShiftId: shiftId,
                        startTime: new Date().toISOString()
                    });
                } catch (e: unknown) {
                    const errorMsg = e instanceof Error ? e.message : 'Error de conexión con la base de datos';
                    console.error('ClockIn Error:', e);
                    throw new Error(`Error al fichar: ${errorMsg}. Revisa tu conexión o el estado de RLS.`);
                }
            },

            clockOut: async (notes) => {
                const { employee } = useAuthStore.getState();
                if (!employee) throw new Error('No employee logged in');

                const location = get().lastKnownLocation;

                const { error } = await supabase.rpc('clock_out', {
                    p_employee_id: employee.id,
                    p_location: location,
                    p_notes: notes
                });

                if (error) {
                    // AUTO-FIX: If backend says "No active shift", we trust it and reset local state
                    if (error.message && error.message.includes('No active shift found')) {
                        console.warn('⚠️ Desincronización detectada: La base de datos ya cerró el turno. Reseteando local.');
                        set({
                            status: 'idle',
                            currentShiftId: null,
                            startTime: null
                        });
                        return;
                    }
                    throw error;
                }

                set({
                    status: 'idle',
                    currentShiftId: null,
                    startTime: null
                });
            },

            startBreak: async (reason) => {
                const { currentShiftId } = get();
                if (!currentShiftId) throw new Error("No hay turno activo para pausar");

                try {
                    const { data: breakId, error } = await supabase
                        .rpc('start_break_safe', {
                            p_time_entry_id: currentShiftId,
                            p_reason: reason
                        });

                    if (error) throw error;

                    set({ status: 'break', currentBreakId: breakId });
                } catch (e: unknown) {
                    console.error('Error starting break:', e);
                    const errorMsg = e instanceof Error ? e.message : 'Error al iniciar pausa';
                    throw new Error(errorMsg);
                }
            },

            endBreak: async () => {
                const { currentBreakId, currentShiftId } = get();
                if (!currentShiftId) throw new Error("No active shift");

                try {
                    const { error } = await supabase
                        .rpc('end_break_safe', {
                            p_time_entry_id: currentShiftId,
                            p_break_id: currentBreakId
                        });

                    if (error) throw error;

                    set({ status: 'active', currentBreakId: null });
                } catch (e: unknown) {
                    console.error('Error ending break:', e);
                    const errorMsg = e instanceof Error ? e.message : 'Error al finalizar pausa';
                    throw new Error(errorMsg);
                }
            }
        }),
        {
            name: 'time-storage',
        }
    )
);
