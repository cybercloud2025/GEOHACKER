import React from 'react';
import { motion } from 'framer-motion';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-background text-text overflow-hidden relative font-sans selection:bg-primary/30">

            {/* GLOBAL BACKGROUND EFFECTS */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Glow Top Left */}
                <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-primary/5 rounded-full blur-[120px] opacity-70" />
                {/* Glow Bottom Right */}
                <div className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] bg-secondary/5 rounded-full blur-[120px] opacity-70" />

                {/* Grid Pattern (Optional) */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            {/* CONTENT WRAPPER */}
            <motion.main
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full min-h-screen flex flex-col"
            >
                {children}
            </motion.main>
        </div>
    );
};
