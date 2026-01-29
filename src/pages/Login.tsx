import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ArrowRight } from 'lucide-react';
import hackerIcon from '../assets/hacker-icon.png';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { MatrixRain } from '../components/Effects/MatrixRain';
import { playAlarm } from '../utils/audio';
import { TerminalCodeEffect } from '../components/Effects/TerminalCodeEffect';

export const LoginPage = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        pin: '',
        avatar: null as File | null,
        avatarPreview: ''
    });
    const [error, setError] = useState('');
    const { loginWithPin, register, isLoading, isRegistrationEnabled, fetchSettings } = useAuthStore();
    const navigate = useNavigate();

    // Secret Login State
    const [showSecretMode, setShowSecretMode] = useState(false);
    const [secretPin, setSecretPin] = useState('');
    const [alarmTriggered, setAlarmTriggered] = useState(false);
    const [clickState, setClickState] = useState({ count: 0, lastClick: 0 });

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSecretTrigger = (e: React.MouseEvent) => {
        // Prevent file upload trigger if clicking the logo in non-register mode
        if (!isRegistering) {
            e.preventDefault();

            const now = Date.now();
            const timeDiff = now - clickState.lastClick;

            // If more than 2 seconds passed, reset count
            const newCount = (timeDiff > 2000) ? 1 : clickState.count + 1;

            if (newCount >= 4) {
                setShowSecretMode(true);
                setClickState({ count: 0, lastClick: 0 });
            } else {
                setClickState({ count: newCount, lastClick: now });
            }
        }
    };

    const handleSecretPinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        setSecretPin(val);
        if (val.length === 8) {
            performSecretLogin(val);
        }
    };

    const performSecretLogin = async (pin: string) => {
        const { success } = await loginWithPin(pin);
        if (success) {
            const { employee } = useAuthStore.getState();
            if (employee?.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/');
            }
        } else {
            // TRAP ACTIVATED
            setAlarmTriggered(true);
            playAlarm();
            setTimeout(() => {
                setAlarmTriggered(false);
                setSecretPin('');
                setShowSecretMode(false);
            }, 3000);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, files } = e.target;
        if (name === 'access_code') {
            const val = value.replace(/\D/g, '');
            setFormData(prev => ({ ...prev, pin: val }));
            if (!isRegistering && val.length === 4) {
                performLogin(val);
            }
        } else if (name === 'avatar' && files && files[0]) {
            const file = files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    avatar: file,
                    avatarPreview: reader.result as string
                }));
            };
            reader.readAsDataURL(file);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const performLogin = async (pinValue: string) => {
        if (pinValue.length < 4) {
            setError('PIN muy corto');
            return;
        }
        setError('');

        const { success, error: loginError } = await loginWithPin(pinValue);

        if (success) {
            handleSuccessRedirect();
        } else {
            setError(loginError || 'Error al entrar');
            setFormData(prev => ({ ...prev, pin: '' }));
        }
    };

    const handleSuccessRedirect = () => {
        const { employee } = useAuthStore.getState();
        if (employee?.role === 'admin') {
            navigate('/admin');
        } else {
            navigate('/');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isRegistering) {
            if (!formData.firstName.trim() || !formData.lastName.trim() || formData.pin.length < 4) {
                setError('Completa todos los campos');
                return;
            }

            let avatarUrl: string | null = null;
            if (formData.avatar) {
                // In a real app we'd upload to Supabase Storage first
                // For this demo, let's assume we pass the base64 or a mock path
                // Actually, let's keep it simple and just acknowledge it's there
                avatarUrl = formData.avatarPreview;
            }

            const { success, error: regError } = await register(
                formData.firstName,
                formData.lastName,
                formData.pin,
                formData.email,
                avatarUrl
            );
            if (success) {
                handleSuccessRedirect();
            } else {
                setError(regError || 'Error al registrar');
            }
        } else {
            performLogin(formData.pin);
        }
    };

    const [triggerGlitch, setTriggerGlitch] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setTriggerGlitch(true);
            setTimeout(() => setTriggerGlitch(false), 800);
        }, 4000); // Slower frequency (every 4s instead of 2s)
        return () => clearInterval(interval);
    }, []);

    // Auto-hide error after 3 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const glitchVariants = {
        hidden: { x: 0, opacity: 1 },
        visible: {
            x: [0, -2, 2, -2, 2, 0],
            y: [0, 2, -2, 2, -2, 0],
            filter: [
                'hue-rotate(0deg)',
                'hue-rotate(90deg) contrast(150%)',
                'hue-rotate(0deg)'
            ],
            transition: { duration: 0.6, repeat: 1 } // Slower animation (0.6s) and less repetition
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 relative overflow-hidden bg-background">
            {/* MATRIX BACKGROUND */}
            <MatrixRain />

            {/* Background Effects (Gradient overlapping Matrix for depth) */}
            <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-primary/10 rounded-full blur-[100px] mix-blend-screen" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-secondary/10 rounded-full blur-[100px] mix-blend-screen" />



            <motion.div
                layout
                className="w-full max-w-md relative z-10"
            >
                {/* Header */}
                <div className="text-center space-y-2 mb-8">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex justify-center mb-6"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                            {isRegistering ? (
                                <label className="relative w-24 h-24 bg-surfaceHighlight border border-white/10 rounded-2xl flex items-center justify-center shadow-glow-primary overflow-hidden group cursor-pointer transition-all hover:border-primary/50">
                                    {formData.avatarPreview ? (
                                        <img src={formData.avatarPreview} className="w-full h-full object-cover" alt="Preview" />
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <UserPlus className="w-8 h-8 text-primary mb-1" />
                                            <span className="text-[10px] text-primary/70 font-bold">SUBIR FOTO</span>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        name="avatar"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleInputChange}
                                    />
                                </label>
                            ) : (
                                <div
                                    onClick={handleSecretTrigger}
                                    className="relative w-24 h-24 bg-surfaceHighlight border border-white/10 rounded-2xl flex items-center justify-center shadow-glow-primary overflow-hidden group cursor-default transition-all hover:border-primary/50"
                                >
                                    <div className="w-full h-full">
                                        <img
                                            src={hackerIcon}
                                            alt="Hacker Shield"
                                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* ANIMATED TITLE */}
                    <motion.h2
                        key={isRegistering ? 'reg-title' : 'login-title'}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{
                            y: 0,
                            opacity: 1,
                            filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"]
                        }}
                        transition={{
                            y: { duration: 0.5 },
                            opacity: { duration: 0.5 },
                            filter: { duration: 10, repeat: Infinity, ease: "linear" } // Slow color cycle
                        }}
                        className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-white to-purple-500 tracking-[0.2em] uppercase drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                    >
                        {isRegistering ? 'Nuevo Usuario' : 'GEO HACKER'}
                    </motion.h2>



                    <p className="text-muted">
                        {isRegistering ? 'Crea tu cuenta de acceso' : 'Introduce tu PIN de acceso'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6 bg-black/20 backdrop-blur-xl p-8 rounded-2xl border border-transparent animate-border-pulse-slow shadow-2xl transition-all relative">

                    {/* FORM GLITCH OVERLAY (When triggered) */}
                    {triggerGlitch && (
                        <div className="absolute inset-0 bg-cyan-500/10 z-0 pointer-events-none animate-pulse rounded-2xl mix-blend-overlay" />
                    )}

                    <AnimatePresence mode="popLayout">
                        {isRegistering && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4 overflow-hidden"
                            >
                                <Input
                                    name="firstName"
                                    placeholder="Nombre"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    required
                                    autoComplete="off"
                                />
                                <Input
                                    name="lastName"
                                    placeholder="Apellidos"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    required
                                    autoComplete="off"
                                />
                                <Input
                                    type="email"
                                    name="email"
                                    placeholder="Correo Electrónico"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    required
                                    autoComplete="off"
                                />


                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* PIN INPUT WITH GLITCH */}
                    <motion.div
                        className="space-y-2 relative z-10"
                        variants={glitchVariants}
                        animate={triggerGlitch ? "visible" : "hidden"}
                    >
                        <Input
                            type="text"
                            name="access_code"
                            placeholder={triggerGlitch ? "HACKING..." : (isRegistering ? "Elige un PIN (4 dígitos)" : "PIN (4 dígitos o @ + 5)")}
                            className={`text-center font-mono transition-all duration-100 ${!isRegistering ? 'text-3xl tracking-[1em] h-16' : ''} ${triggerGlitch ? 'border-cyan-400 shadow-[0_0_20px_cyan] text-cyan-400' : ''} text-security-disc`}
                            maxLength={formData.pin.startsWith('@') ? 6 : 4}
                            value={formData.pin}
                            onChange={(e) => {
                                const rawValue = e.target.value;
                                let cleaned = '';

                                if (rawValue.startsWith('@')) {
                                    // Format: @ + 5 digits
                                    cleaned = '@' + rawValue.slice(1).replace(/\D/g, '').slice(0, 5);
                                } else {
                                    // Format: 4 digits
                                    cleaned = rawValue.replace(/\D/g, '').slice(0, 4);
                                }

                                setFormData(prev => ({ ...prev, pin: cleaned }));

                                if (!isRegistering) {
                                    if (cleaned.startsWith('@') && cleaned.length === 6) {
                                        performLogin(cleaned);
                                    } else if (!cleaned.startsWith('@') && cleaned.length === 4) {
                                        performLogin(cleaned);
                                    }
                                }
                            }}
                            disabled={isLoading}
                            autoFocus={!isRegistering}
                            autoComplete="one-time-code"
                            spellCheck={false}
                        />
                        {triggerGlitch && (
                            <div className="absolute inset-0 bg-transparent flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-mono text-cyan-500 animate-ping absolute right-2 top-2">⚠️ SYSTEM BREACH</span>
                            </div>
                        )}
                    </motion.div>

                    {isRegistering && (
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            Crear Cuenta
                            <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    )}

                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-yellow-400 font-bold text-center text-sm drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]"
                        >
                            {error}
                        </motion.p>
                    )}

                    <div className="pt-4 border-t border-white/5 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                if (!isRegistering && !isRegistrationEnabled) return;
                                setIsRegistering(!isRegistering);
                                setError('');
                                setFormData({ firstName: '', lastName: '', email: '', pin: '', avatar: null, avatarPreview: '' });
                            }}
                            disabled={!isRegistering && !isRegistrationEnabled}
                            className={`text-sm font-bold transition-colors drop-shadow-sm ${!isRegistering && !isRegistrationEnabled
                                ? 'text-muted cursor-not-allowed opacity-50'
                                : 'text-red-600 hover:text-red-500'
                                }`}
                        >
                            {isRegistering
                                ? '¿Ya tienes cuenta? Inicia sesión'
                                : (isRegistrationEnabled ? '¿No tienes cuenta? Regístrate aquí' : 'Registros desactivados')}
                        </button>
                    </div>

                    {!isRegistering && (
                        <div className="text-center pt-2">
                            <span className="text-xs font-bold text-[#CCFF00] animate-pulse tracking-widest uppercase drop-shadow-[0_0_10px_rgba(204,255,0,0.8)]">
                                ● Sistema Activado
                            </span>
                        </div>
                    )}
                </form>
            </motion.div>

            {/* SECRET LOGIN MODAL */}
            <AnimatePresence>
                {showSecretMode && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 overflow-hidden"
                    >
                        {/* TERMINAL BACKGROUND */}
                        <TerminalCodeEffect />

                        <div className="w-full max-w-sm p-8 text-center space-y-6 relative z-10 bg-black rounded-xl border border-red-500/20 shadow-[0_0_80px_rgba(220,38,38,0.4)]">
                            <h3 className="text-3xl font-black text-red-600 tracking-[0.2em] animate-pulse drop-shadow-[0_0_10px_rgba(220,38,38,0.8)] border-b-2 border-red-900/50 pb-4">
                                MASTER ACCESS
                            </h3>
                            <Input
                                autoFocus
                                type="text"
                                name="secret_pin"
                                placeholder="ACCESS CODE"
                                value={secretPin}
                                onChange={handleSecretPinChange}
                                maxLength={8}
                                className="text-center text-4xl tracking-widest text-[#00FF00] bg-black/50 border-2 border-red-900/50 focus:border-red-500 h-24 text-security-disc shadow-[inset_0_0_20px_rgba(0,0,0,1)] font-mono placeholder:text-red-900/50"
                                autoComplete="off"
                            />
                            <div className="text-sm text-[#39FF14] font-mono tracking-[0.3em] font-bold drop-shadow-[0_0_5px_#39FF14]">
                                SECURE CONNECTION ESTABLISHED
                            </div>
                            <button
                                onClick={() => setShowSecretMode(false)}
                                className="text-xs text-yellow-500 animate-[pulse_1.5s_infinite] hover:text-yellow-400 transition-colors uppercase tracking-[0.2em] font-black border border-yellow-900/50 py-3 px-6 rounded-md bg-yellow-950/20"
                            >
                                [ ABORT SEQUENCE ]
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ALARM OVERLAY */}
            <AnimatePresence>
                {alarmTriggered && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[100] bg-red-600 flex items-center justify-center overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmQ0O...')] opacity-20 mix-blend-overlay"></div>
                        <motion.h1
                            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                            transition={{ duration: 0.2, repeat: Infinity }}
                            className="text-6xl md:text-9xl font-black text-black z-10 text-center tracking-tighter"
                        >
                            ACCESO
                            <br />
                            DENEGADO
                        </motion.h1>
                    </motion.div>
                )}
            </AnimatePresence>


        </div>
    );
};
