import { useEffect } from 'react';
import { usePresenceStore } from '../stores/usePresenceStore';
import { useAuthStore } from '../stores/useAuthStore';

export const PresenceManager = () => {
    const initPresence = usePresenceStore((state) => state.initPresence);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    useEffect(() => {
        if (!isAuthenticated) return;

        const cleanup = initPresence();
        return () => {
            cleanup();
        };
    }, [isAuthenticated, initPresence]);

    return null;
};
