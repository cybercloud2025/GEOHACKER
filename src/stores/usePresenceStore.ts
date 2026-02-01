import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

interface PresenceState {
    onlineUserIds: Set<string>;
    initPresence: () => () => void; // Returns cleanup function
}

interface PresenceValue {
    user_id: string;
    online_at: string;
}

export const usePresenceStore = create<PresenceState>((set) => ({
    onlineUserIds: new Set(),

    initPresence: () => {
        const { employee, isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated || !employee) return () => { };

        const channel = supabase.channel('online-users');

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const userIds = new Set<string>();

                Object.values(state).forEach((presences) => {
                    (presences as unknown as PresenceValue[]).forEach((presence) => {
                        if (presence.user_id) {
                            userIds.add(presence.user_id);
                        }
                    });
                });

                set({ onlineUserIds: userIds });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: employee.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    }
}));
