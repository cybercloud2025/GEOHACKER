import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Input } from '../components/ui/Input';

const MatrixRain = React.lazy(() => import('../components/Effects/MatrixRain').then(m => ({ default: m.MatrixRain })));

export const AdminRegisterPage = () => {
    const navigate = useNavigate();
    const { createAdmin, isLoading } = useAuthStore();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loadEffects, setLoadEffects] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        pin: '',
        avatarPreview: '',
        companyName: '',
        fiscalId: ''
    });

    useEffect(() => {
        const timer = setTimeout(() => setLoadEffects(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, files } = e.target;
        if (name === 'pin') {
            // Admin Rule: @ + 5 digits or plain 6 digits
            let cleaned = '';
            if (value.startsWith('@')) {
                cleaned = '@' + value.slice(1).replace(/\D/g, '').slice(0, 5);
            } else {
                cleaned = value.replace(/\D/g, '').slice(0, 6);
            }
            setFormData(prev => ({ ...prev, pin: cleaned }));
        } else if (name === 'avatar' && files && files[0]) {
            const file = files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    avatarPreview: reader.result as string
                }));
            };
            reader.readAsDataURL(file);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.pin || !formData.email.trim() || !formData.companyName.trim() || !formData.fiscalId.trim()) {
            setError('TODOS LOS CAMPOS SON OBLIGATORIOS');
            return;
        }

        const isAdminPin = formData.pin.startsWith('@');
        const requiredLen = isAdminPin ? 6 : 4;

        if (formData.pin.length < requiredLen) {
            setError(isAdminPin ? 'PIN DE ADMIN INCOMPLETO (@ + 5)' : 'PIN DEMASIADO CORTO (MÍN 4)');
            return;
        }

        const { success: regSuccess, error: regError } = await createAdmin(
            formData.firstName,
            formData.lastName,
            formData.pin,
            formData.email,
            formData.avatarPreview || null,
            formData.companyName,
            formData.fiscalId
        );

        if (regSuccess) {
            setSuccess(true);
            setTimeout(() => navigate('/login'), 5000);
        } else {
            setError(regError || 'ERROR AL CREAR ADMINISTRADOR');
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

    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 relative overflow-hidden bg-black font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
            {/* Background Layers matching App */}
            <div className="absolute inset-0 z-0 opacity-40">
                <React.Suspense fallback={null}>
                    {loadEffects && <MatrixRain />}
                </React.Suspense>
            </div>

            <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-cyan-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[80vw] h-[80vw] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow delay-1000" />

            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px] z-0 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-full max-w-md z-10"
            >
                {/* Border Glow Gradient */}
                <div className="absolute -inset-[3px] rounded-[28px] blur-[2px] opacity-100 animate-border-tech" />

                <div className="relative bg-black/80 backdrop-blur-2xl rounded-3xl border-4 border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
                    {/* Header Decoration matching LoginPage */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-100" />
                    <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
                        <div className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_12px_rgba(239,68,68,1.0)]" />
                        <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1.0)]" />
                    </div>

                    <div className="p-8 pt-10 space-y-8">
                        {/* Header */}
                        <div className="text-center space-y-4">
                            <div className="flex justify-center mb-2">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="relative"
                                >
                                    <div className="absolute inset-0 bg-cyan-400/20 blur-2xl rounded-full animate-pulse" />
                                    <label className="relative w-28 h-28 bg-black/60 border-2 border-cyan-400 rounded-full flex items-center justify-center cursor-pointer hover:border-cyan-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all group/avatar overflow-hidden shadow-[0_0_25px_rgba(34,211,238,0.2)]">
                                        {formData.avatarPreview ? (
                                            <img src={formData.avatarPreview} className="w-full h-full object-cover" alt="Avatar" />
                                        ) : (
                                            <div className="flex flex-col items-center text-cyan-400 group-hover/avatar:text-cyan-300 transition-colors">
                                                <ShieldCheck className="w-10 h-10 mb-1" />
                                                <span className="text-[9px] tracking-widest font-black">CARGAR</span>
                                            </div>
                                        )}
                                        <input type="file" name="avatar" accept="image/*" className="hidden" onChange={handleInputChange} />
                                    </label>
                                </motion.div>
                            </div>
                            <div className="space-y-2">
                                <h2 className={`text-3xl font-black tracking-[0.2em] relative inline-block ${triggerGlitch ? 'glitch-text' : ''}`}>
                                    <span className="animate-text-tech bg-clip-text text-white">RECLUTAR ADMIN</span>
                                </h2>
                                <p className="text-[14px] text-green-400 tracking-[0.4em] uppercase font-black drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">
                                    NUEVA ORGANIZACIÓN
                                </p>
                            </div>
                        </div>

                        {success ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-12 space-y-4"
                            >
                                <div className="text-yellow-400 font-bold tracking-widest text-lg">CUENTA EN ESPERA</div>
                                <p className="text-white/60 text-sm">Tu solicitud ha sido enviada. El Administrador Maestro debe validar tu acceso antes de que puedas entrar.</p>
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-4">
                                    <motion.div
                                        className="h-full bg-yellow-500"
                                        initial={{ width: "0%" }}
                                        animate={{ width: "100%" }}
                                        transition={{ duration: 5 }}
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        name="firstName"
                                        placeholder="NOMBRE"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        disabled={isLoading}
                                        className="bg-yellow-100 border-2 border-white/20 text-black placeholder:text-black/40 focus:border-cyan-500 focus:bg-yellow-100 focus:text-black rounded-xl h-10 text-center font-bold tracking-wider text-sm transition-none"
                                    />
                                    <Input
                                        name="lastName"
                                        placeholder="APELLIDOS"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        disabled={isLoading}
                                        className="bg-yellow-100 border-2 border-white/20 text-black placeholder:text-black/40 focus:border-cyan-500 focus:bg-yellow-100 focus:text-black rounded-xl h-10 text-center font-bold tracking-wider text-sm transition-none"
                                    />
                                </div>

                                <Input
                                    type="email"
                                    name="email"
                                    placeholder="EMAIL (OBLIGATORIO)"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    className="bg-yellow-100 border-2 border-white/20 text-black placeholder:text-black/40 focus:border-cyan-500 focus:bg-yellow-100 focus:text-black rounded-xl h-10 text-center font-bold tracking-wider text-sm transition-none"
                                />

                                <Input
                                    name="companyName"
                                    placeholder="NOMBRE DE LA EMPRESA"
                                    value={formData.companyName}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    className="bg-yellow-100 border-2 border-white/20 text-black placeholder:text-black/40 focus:border-cyan-500 focus:bg-yellow-100 focus:text-black rounded-xl h-10 text-center font-bold tracking-wider text-sm transition-none"
                                />

                                <Input
                                    name="fiscalId"
                                    placeholder="DNI / NIF / CIF"
                                    value={formData.fiscalId}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    className="bg-yellow-100 border-2 border-white/20 text-black placeholder:text-black/40 focus:border-cyan-500 focus:bg-yellow-100 focus:text-black rounded-xl h-10 text-center font-bold tracking-wider text-sm transition-none"
                                />

                                <div className="space-y-2">
                                    <Input
                                        name="pin"
                                        placeholder="PIN (P.EJ. @12345)"
                                        value={formData.pin}
                                        onChange={handleInputChange}
                                        disabled={isLoading}
                                        className="bg-black/40 border-4 border-white/20 text-[#39FF14] placeholder:text-[#39FF14]/30 text-center text-base font-mono tracking-[0.4em] h-11 rounded-xl focus:border-cyan-500 focus:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                                    />
                                    <p className="text-[10px] text-yellow-500 font-bold tracking-[0.2em] text-center uppercase">USA @ PARA PIN DE ADMINISTRADOR</p>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-yellow-500 text-[10px] font-bold text-center tracking-widest uppercase flex items-center justify-center gap-2"
                                    >
                                        <div className="w-1 h-1 bg-yellow-500 rounded-full animate-ping" />
                                        {error}
                                    </motion.div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-11 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black text-sm font-black tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30_rgba(34,211,238,0.5)] flex items-center justify-center"
                                >
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    CREAR ORGANIZACIÓN
                                </button>

                                <div className="text-center mt-4">
                                    <Link
                                        to="/login"
                                        className="text-[12px] font-black text-red-500 hover:text-red-400 transition-all border-2 border-red-500/50 hover:border-red-500 rounded-lg py-2 px-4 tracking-[0.2em] flex items-center justify-center gap-2 uppercase"
                                    >
                                        <ArrowLeft className="w-3 h-3" />
                                        VOLVER AL ACCESO PRINCIPAL
                                    </Link>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
