import React from 'react';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full space-y-1">
                {label && <label className="text-xs text-muted uppercase tracking-wider font-medium ml-1">{label}</label>}
                <div className="relative group">
                    <input
                        ref={ref}
                        className={twMerge(
                            "w-full bg-surface/50 border border-white/10 rounded-xl px-4 py-3 text-lg outline-none transition-all placeholder:text-white/20",
                            "focus:border-primary/50 focus:shadow-[0_0_15px_rgba(0,247,255,0.1)] focus:bg-surfaceHighlight",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            error && "border-error/50 focus:border-error focus:shadow-[0_0_15px_rgba(255,42,42,0.1)]",
                            className
                        )}
                        {...props}
                    />
                    {/* Decorative line */}
                    <div className="absolute bottom-0 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500 will-change-transform" />
                </div>
                {error && <p className="text-xs text-error ml-1">{error}</p>}
            </div>
        );
    }
);
