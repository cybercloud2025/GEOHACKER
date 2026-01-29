import { twMerge } from 'tailwind-merge';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    isLoading?: boolean;
    children?: React.ReactNode;
}

export const Button = ({
    className,
    variant = 'primary',
    isLoading,
    children,
    disabled,
    ...props
}: ButtonProps) => {
    const baseStyles = "relative overflow-hidden rounded-xl px-6 py-3 font-medium transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 hover:shadow-[0_0_20px_rgba(0,247,255,0.3)]",
        secondary: "bg-surfaceHighlight border border-white/10 text-white hover:bg-white/10 hover:border-white/30",
        danger: "bg-error/10 text-error border border-error/50 hover:bg-error/20 hover:shadow-[0_0_20px_rgba(255,42,42,0.3)]",
        ghost: "bg-transparent text-muted hover:text-white"
    };

    return (
        <motion.button
            whileTap={{ scale: 0.98 }}
            className={twMerge(baseStyles, variants[variant], className)}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading ? (
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            ) : null}
            {children}

            {/* Shine effect on hover */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shine_1.5s_ease-in-out] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0 pointer-events-none" />
        </motion.button>
    );
};
