import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ShieldCheck } from 'lucide-react';
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
        if (!isRegistering) {
            e.preventDefault();
            const now = Date.now();
            const timeDiff = now - clickState.lastClick;
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
            setError('PIN INVÁLIDO');
            return;
        }
        setError('');
        const { success, error: loginError } = await loginWithPin(pinValue);
        if (success) {
            handleSuccessRedirect();
        } else {
            setError(loginError || 'ACCESO DENEGADO');
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
            const is_admin_pin = formData.pin.startsWith('@');
            const required_len = is_admin_pin ? 6 : 4;

            if (!formData.firstName.trim() || !formData.lastName.trim() || formData.pin.length < required_len) {
                setError(is_admin_pin ? 'PIN DE ADMIN INCOMPLETO (@ + 5)' : 'PIN DE USUARIO INCOMPLETO (4)');
                return;
            }

            let avatarUrl: string | null = null;
            if (formData.avatar) {
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
                setError(regError || 'REGISTRO FALLIDO');
            }
        } else {
            performLogin(formData.pin);
        }
    };

    const [triggerGlitch, setTriggerGlitch] = useState(false);
    useEffect(() => {
        const interval = setInterval(() => {
            setTriggerGlitch(true);
            setTimeout(() => setTriggerGlitch(false), 200);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Enhanced Glitch animations for text
    const textGlitchVariants = {
        normal: { x: 0, opacity: 1 },
        glitch: {
            x: [0, -2, 2, -2, 0],
            skewX: [0, 10, -10, 0],
            opacity: [1, 0.8, 1],
            transition: { duration: 0.3 }
        }
    };

    return (
        <div className="flex flex-col items-center justify-start sm:justify-center min-h-screen px-4 pt-20 sm:pt-0 relative overflow-hidden bg-black font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
            {/* BACKGROUND LAYERS */}
            <div className="absolute inset-0 z-0 opacity-60">
                <MatrixRain />
            </div>

            {/* Ambient Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-cyan-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[80vw] h-[80vw] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow delay-1000" />

            {/* Grid overlay for tech feel */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px] z-0 pointer-events-none" />

            {/* MAIN CARD */}
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-[420px] relative z-10"
            >
                {/* Glass Card Container */}
                <div className="relative group">
                    {/* Border Glow Gradient - RANDOM BLINKING EFFECT */}
                    <motion.div
                        animate={{
                            backgroundColor: ["rgba(34,211,238,0.5)", "rgba(168,85,247,0.5)", "rgba(239,68,68,0.5)", "rgba(234,179,8,0.5)", "rgba(34,197,94,0.5)"],
                            boxShadow: [
                                "0 0 20px rgba(34,211,238,0.3)",
                                "0 0 20px rgba(168,85,247,0.3)",
                                "0 0 20px rgba(239,68,68,0.3)",
                                "0 0 20px rgba(234,179,8,0.3)",
                                "0 0 20px rgba(34,197,94,0.3)"
                            ]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-[3px] rounded-[28px] blur-[2px] opacity-100"
                    />

                    <div className="relative bg-black/80 backdrop-blur-2xl rounded-3xl border-4 border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">

                        {/* Card Header Decoration */}
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-100" />
                        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
                            <div className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_12px_rgba(239,68,68,1.0)]" />
                            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1.0)]" />
                        </div>

                        <div className="p-8 pt-12 space-y-8">

                            {/* LOGO AREA */}
                            <div className="flex flex-col items-center justify-center space-y-6">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="relative"
                                >
                                    <div className="absolute inset-0 bg-cyan-400/30 blur-2xl rounded-full animate-pulse" />
                                    {isRegistering ? (
                                        <label className="relative w-28 h-28 bg-black/60 border-2 border-cyan-400 rounded-full flex items-center justify-center cursor-pointer hover:border-cyan-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all group/avatar overflow-hidden">
                                            {formData.avatarPreview ? (
                                                <img src={formData.avatarPreview} className="w-full h-full object-cover" alt="Avatar" />
                                            ) : (
                                                <div className="flex flex-col items-center text-cyan-400 group-hover/avatar:text-cyan-300 transition-colors">
                                                    <UserPlus className="w-8 h-8 mb-2" />
                                                    <span className="text-[10px] tracking-widest font-bold">CARGAR</span>
                                                </div>
                                            )}
                                            <input type="file" name="avatar" accept="image/*" className="hidden" onChange={handleInputChange} />
                                        </label>
                                    ) : (
                                        <div
                                            onClick={handleSecretTrigger}
                                            className="relative w-28 h-28 bg-black/60 border-2 border-white/30 rounded-full flex items-center justify-center cursor-default hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all overflow-hidden"
                                        >
                                            <img
                                                src={hackerIcon}
                                                alt="System"
                                                className="w-full h-full object-cover opacity-100"
                                            />
                                        </div>
                                    )}
                                </motion.div>

                                <div className="text-center space-y-2">
                                    <motion.h2
                                        variants={textGlitchVariants}
                                        animate={triggerGlitch ? "glitch" : "normal"}
                                        className="text-4xl font-black tracking-[0.2em] relative inline-block"
                                    >
                                        <motion.span
                                            animate={{
                                                color: ["#22d3ee", "#a855f7", "#ef4444", "#eab308", "#22c55e", "#22d3ee"],
                                                textShadow: [
                                                    "0 0 20px rgba(34,211,238,0.8)",
                                                    "0 0 20px rgba(168,85,247,0.8)",
                                                    "0 0 20px rgba(239,68,68,0.8)",
                                                    "0 0 20px rgba(234,179,8,0.8)",
                                                    "0 0 20px rgba(34,197,94,0.8)",
                                                    "0 0 20px rgba(34,211,238,0.8)"
                                                ]
                                            }}
                                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                            className="bg-clip-text"
                                        >
                                            {isRegistering ? 'NUEVO AGENTE' : 'GEOHACKER'}
                                        </motion.span>
                                    </motion.h2>
                                    <p className="text-[14px] text-green-400 tracking-[0.4em] uppercase font-black drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">
                                        {isRegistering ? 'INICIANDO PROTOCOLO' : 'ACCESO SEGURO AL SISTEMA'}
                                    </p>
                                </div>
                            </div>

                            {/* FORM AREA */}
                            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
                                <AnimatePresence mode="popLayout">
                                    {isRegistering && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0, y: -10 }}
                                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                                            exit={{ opacity: 0, height: 0, y: -10 }}
                                            className="space-y-4 overflow-hidden"
                                        >
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="group/input relative">
                                                    <Input
                                                        name="firstName"
                                                        placeholder="NOMBRE"
                                                        value={formData.firstName}
                                                        onChange={handleInputChange}
                                                        disabled={isLoading}
                                                        className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/30 focus:border-cyan-500 focus:bg-white/10 rounded-xl h-12 text-sm font-bold tracking-wider text-center"
                                                    />
                                                </div>
                                                <div className="group/input relative">
                                                    <Input
                                                        name="lastName"
                                                        placeholder="APELLIDO"
                                                        value={formData.lastName}
                                                        onChange={handleInputChange}
                                                        disabled={isLoading}
                                                        className="bg-white/5 border-2 border-white/20 text-white placeholder:text-white/30 focus:border-cyan-500 focus:bg-white/10 rounded-xl h-12 text-sm font-bold tracking-wider text-center"
                                                    />
                                                </div>
                                            </div>
                                            <Input
                                                type="email"
                                                name="email"
                                                placeholder="EMAIL ADDRESS"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                disabled={isLoading}
                                                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-cyan-500/50 focus:bg-white/10 rounded-xl h-12 text-xs font-bold tracking-wider text-center"
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-4">
                                    <div className="relative group/pin">
                                        <motion.div
                                            animate={error ? { x: [-5, 5, -5, 5, 0] } : {}}
                                            className="relative"
                                        >
                                            <Input
                                                type="text"
                                                name="access_code"
                                                placeholder={
                                                    formData.pin.startsWith('@')
                                                        ? "PIN DE ADMIN (5 DÍGITOS)"
                                                        : (isRegistering ? "CREAR PIN (4)" : "INGRESAR PIN")
                                                }
                                                className={`relative z-10 text-center font-mono text-2xl tracking-[0.5em] h-16 rounded-2xl border-4 transition-all duration-300
                                                    ${error
                                                        ? 'bg-red-500/10 border-red-500 text-red-200 placeholder:text-red-500/50 placeholder:text-sm'
                                                        : 'bg-black/60 border-red-600 text-red-500 placeholder:text-yellow-500/50 focus:border-red-500 focus:shadow-[0_0_30px_rgba(239,68,68,0.2)] placeholder:text-sm'
                                                    }
                                                `}
                                                maxLength={6}
                                                value={formData.pin}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value;
                                                    let cleaned = '';
                                                    if (rawValue.startsWith('@')) {
                                                        // Admin Rule: @ + 5 digits
                                                        cleaned = '@' + rawValue.slice(1).replace(/\D/g, '').slice(0, 5);
                                                    } else {
                                                        // User Rule: 4 digits
                                                        cleaned = rawValue.replace(/\D/g, '').slice(0, 4);
                                                    }
                                                    setFormData(prev => ({ ...prev, pin: cleaned }));

                                                    // Auto-login logic
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
                                                autoComplete="off"
                                            />
                                            <div className="absolute -inset-1 bg-red-600/10 blur opacity-0 group-hover/pin:opacity-100 transition-opacity rounded-2xl" />
                                        </motion.div>
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center justify-center gap-2 text-red-400 font-bold text-[10px] tracking-widest uppercase"
                                        >
                                            <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
                                            {error}
                                        </motion.div>
                                    )}

                                    {/* Action Buttons */}
                                    {isRegistering && (
                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full h-14 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black font-black tracking-widest text-sm rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all duration-300 transform active:scale-[0.98]"
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {isRegistering ? <UserPlus className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                                                {isRegistering ? 'INICIALIZAR IDENTIDAD' : 'ACCEDER AL SISTEMA'}
                                            </span>
                                        </Button>
                                    )}
                                </div>
                            </form>

                            {/* Secondary Actions */}
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRegistering(!isRegistering);
                                        setError('');
                                        setFormData(prev => ({ ...prev, pin: '' }));
                                    }}
                                    className={`text-[12px] font-black tracking-[0.2em] uppercase transition-all duration-300 
                                        ${isRegistering
                                            ? 'text-cyan-400/70 hover:text-cyan-400'
                                            : (isRegistrationEnabled ? 'text-yellow-400 hover:text-yellow-300 hover:scale-105' : 'text-gray-500 cursor-not-allowed')
                                        }`}
                                >
                                    {isRegistering
                                        ? '¿YA TIENES UNA IDENTIDAD? VOLVER'
                                        : (isRegistrationEnabled ? 'ESTABLECER NUEVA IDENTIDAD' : 'REGISTROS BLOQUEADOS')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* System Status */}
            {!isRegistering && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-8 mb-8 sm:absolute sm:bottom-24 text-center"
                >
                    <div className="flex items-center gap-3 text-[14px] text-cyan-400 font-mono tracking-[0.2em] font-black drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                        <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
                        SYSTEM ONLINE // V.3.0.1
                    </div>
                </motion.div>
            )}

            {/* SECRET MODAL */}
            <AnimatePresence>
                {showSecretMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/98"
                    >
                        <TerminalCodeEffect />
                        <div className="relative z-10 w-full max-w-sm p-8 bg-black border-4 border-emerald-500 animate-[pulse_1s_infinite] shadow-[0_0_100px_rgba(16,185,129,0.3)] rounded-3xl text-center space-y-8 transition-all">
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-red-600 tracking-[0.3em] uppercase glitch-text" data-text="MASTER ACCESS">MASTER ACCESS</h3>
                                <p className="text-[10px] text-emerald-400 font-black tracking-widest uppercase">ENTORNO RESTRINGIDO</p>
                            </div>

                            <Input
                                autoFocus
                                type="password"
                                value={secretPin}
                                onChange={handleSecretPinChange}
                                maxLength={8}
                                placeholder="CÓDIGO DE ACCESO"
                                className="bg-transparent border-b-2 border-emerald-900 text-center text-emerald-400 text-3xl font-mono tracking-[0.5em] focus:border-emerald-400 focus:outline-none placeholder:text-emerald-900/30 h-16 rounded-none w-full"
                            />

                            <button
                                onClick={() => setShowSecretMode(false)}
                                className="text-xs text-yellow-500 hover:text-yellow-400 font-mono tracking-widest uppercase transition-colors"
                            >
                                [ TERMINAR SESIÓN ]
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ALARM */}
            <AnimatePresence>
                {alarmTriggered && (
                    <motion.div className="fixed inset-0 z-[100] bg-red-600 flex items-center justify-center p-4">
                        <motion.h1
                            animate={{ opacity: [1, 0, 1], scale: [1, 1.1, 1] }}
                            transition={{ duration: 0.2, repeat: Infinity }}
                            className="text-6xl md:text-9xl font-black text-black tracking-tighter text-center"
                        >
                            ACCESO<br />DENEGADO
                        </motion.h1>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};
