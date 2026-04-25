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

    // Acciones
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

                const { data } = await supabase.rpc('get_active_shift', {
                    p_employee_id: employee.id
                });

                const shift = Array.isArray(data) ? data[0] : null;
                if (shift) {
                    set({
                        status: shift.status as 'active' | 'break',
                        currentShiftId: shift.id,
                        startTime: shift.start_time
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
                        // RECUPERACIÓN INTELIGENTE: Si la BD dice que ya tenemos un turno activo, sincronizamos el estado local
                        if (error.message && error.message.includes('already has an active shift')) {

                            set({ status: 'active' });
                            // No tenemos el ID, pero clockOut lo maneja por employee_id, así que está bien.
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
                    // AUTO-FIX: Si el backend dice "No active shift", confiamos y reseteamos el estado local
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
                const employeeId = useAuthStore.getState().employee?.id;
                if (!currentShiftId) throw new Error("No hay turno activo para pausar");
                if (!employeeId) throw new Error("No autenticado");

                try {
                    const { data, error } = await supabase.rpc('start_break', {
                        p_employee_id: employeeId,
                        p_shift_id: currentShiftId,
                        p_reason: reason
                    });

                    if (error) throw error;
                    set({ status: 'break', currentBreakId: (data as { break_id: string }).break_id });
                } catch (e: unknown) {
                    console.error('Error starting break:', e);
                    const errorMsg = e instanceof Error ? e.message : 'Error al iniciar pausa';
                    throw new Error(errorMsg);
                }
            },

            endBreak: async () => {
                const { currentBreakId, currentShiftId } = get();
                const employeeId = useAuthStore.getState().employee?.id;
                if (!currentShiftId) throw new Error("No hay turno activo");
                if (!employeeId) throw new Error("No autenticado");

                try {
                    const { error } = await supabase.rpc('end_break', {
                        p_employee_id: employeeId,
                        p_shift_id: currentShiftId,
                        p_break_id: currentBreakId ?? null
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
