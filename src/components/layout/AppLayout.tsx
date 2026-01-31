import React from 'react';
import { motion } from 'framer-motion';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-background text-text overflow-hidden relative font-sans selection:bg-primary/30">

            {/* GLOBAL BACKGROUND EFFECTS */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Glow Top Left - Optimized for Safari */}
                <div
                    className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-primary/5 rounded-full blur-[60px] opacity-60"
                    style={{ willChange: 'transform, opacity' }}
                />
                {/* Glow Bottom Right - Optimized for Safari */}
                <div
                    className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] bg-secondary/5 rounded-full blur-[60px] opacity-60"
                    style={{ willChange: 'transform, opacity' }}
                />

                {/* Grid Pattern - Low opacity for better performance */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />
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
