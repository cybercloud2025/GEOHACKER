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

                // Check for active shift in DB
                const { data } = await supabase
                    .from('time_entries')
                    .select('*')
                    .eq('employee_id', employee.id)
                    .is('end_time', null)
                    .order('start_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data) {
                    // Found active shift
                    set({
                        status: data.status as 'active' | 'break', // Cast to match type
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
                } catch (e: any) {
                    const errorMsg = e.message || 'Error de conexión con la base de datos';
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
                    // 1. Create break record
                    const { data, error } = await supabase.from('breaks').insert({
                        time_entry_id: currentShiftId,
                        start_time: new Date().toISOString(),
                        reason: reason
                    }).select('id').single();

                    if (error) throw error;

                    // 2. Update time entry status
                    await supabase
                        .from('time_entries')
                        .update({ status: 'break' })
                        .eq('id', currentShiftId);

                    set({ status: 'break', currentBreakId: data.id });
                } catch (e: any) {
                    console.error('Error starting break:', e);
                    throw new Error(e.message || 'Error al iniciar pausa');
                }
            },

            endBreak: async () => {
                const { currentBreakId, currentShiftId } = get();
                if (!currentShiftId) throw new Error("No active shift");

                try {
                    // 1. Close the break
                    if (currentBreakId) {
                        await supabase
                            .from('breaks')
                            .update({ end_time: new Date().toISOString() })
                            .eq('id', currentBreakId);
                    } else {
                        // Fallback: Close latest open break for this shift
                        await supabase
                            .from('breaks')
                            .update({ end_time: new Date().toISOString() })
                            .eq('time_entry_id', currentShiftId)
                            .is('end_time', null);
                    }

                    // 2. Update time entry status
                    await supabase
                        .from('time_entries')
                        .update({ status: 'active' })
                        .eq('id', currentShiftId);

                    set({ status: 'active', currentBreakId: null });
                } catch (e: any) {
                    console.error('Error ending break:', e);
                    throw new Error(e.message || 'Error al finalizar pausa');
                }
            }
        }),
        {
            name: 'time-storage',
        }
    )
);
