import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, UserX, Users, Edit } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../stores/useAuthStore';

interface CreateAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateAdminModal = ({ isOpen, onClose, onSuccess }: CreateAdminModalProps) => {
    const { createAdmin } = useAuthStore();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!pin.startsWith('@') || pin.length !== 6) {
                throw new Error('El PIN de administrador DEBE tener el formato @ + 5 dígitos (ej: @12345)');
            }

            const result = await createAdmin(firstName, lastName, pin, email);

            if (result.success) {
                onSuccess();
                setFirstName('');
                setLastName('');
                setEmail('');
                setPin('');
            } else {
                setError(result.error || 'Error al crear administrador');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-purple-500/30 rounded-xl w-full max-w-md p-6 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield className="w-6 h-6 text-purple-500" />
                        Crear Nuevo Administrador
                    </h3>
                    <button onClick={onClose} className="text-muted hover:text-white">
                        <UserX className="w-6 h-6" />
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase mb-1">Nombre</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-purple-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase mb-1">Apellidos</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-purple-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Email (Opcional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-purple-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">PIN de Admin (@ + 5 dígitos)</label>
                        <input
                            type="text"
                            maxLength={6}
                            value={pin}
                            onChange={(e) => {
                                const rawValue = e.target.value;
                                let cleaned = '';
                                if (rawValue.startsWith('@')) {
                                    cleaned = '@' + rawValue.slice(1).replace(/\D/g, '').slice(0, 5);
                                } else {
                                    cleaned = rawValue.replace(/\D/g, '').slice(0, 4);
                                }
                                setPin(cleaned);
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-purple-500 focus:outline-none tracking-widest font-mono text-center text-lg"
                            placeholder="****"
                            required
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-none"
                            disabled={loading}
                        >
                            {loading ? 'Creando...' : 'Crear Admin'}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateUserModal = ({ isOpen, onClose, onSuccess }: CreateUserModalProps) => {
    const { register, employee } = useAuthStore();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (pin.length !== 4) throw new Error('El PIN debe tener 4 dígitos');

            const adminInviteCode = (employee as any)?.invite_code;
            const result = await register(firstName, lastName, pin, email, null, adminInviteCode);

            if (result.success) {
                alert(`Usuario creado con éxito.\n\nPIN: ${pin}\nVinculado a: ${employee?.first_name} ${employee?.last_name}`);
                onSuccess();
                setFirstName('');
                setLastName('');
                setEmail('');
                setPin('');
            } else {
                setError(result.error || 'Error al crear usuario');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-primary/30 rounded-xl w-full max-w-md p-6 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Registrar Nuevo Empleado
                    </h3>
                    <button onClick={onClose} className="text-muted hover:text-white">
                        <UserX className="w-6 h-6" />
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase mb-1">Nombre</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-primary focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase mb-1">Apellidos</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-primary focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Email (Opcional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-primary focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Asignar PIN de Acceso (4 dígitos)</label>
                        <input
                            type="text"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => {
                                const rawValue = e.target.value;
                                const cleaned = rawValue.replace(/\D/g, '').slice(0, 4);
                                setPin(cleaned);
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-primary focus:outline-none tracking-widest font-mono text-center text-lg"
                            placeholder="****"
                            required
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            disabled={loading}
                        >
                            {loading ? 'Registrando...' : 'Registrar Empleado'}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: any;
}

export const EditUserModal = ({ isOpen, onClose, onSuccess, user }: EditUserModalProps) => {
    const { updateEmployee } = useAuthStore();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFirstName(user.first_name || '');
            setLastName(user.last_name || '');
            setEmail(user.employee_email || '');
            setPin(user.pin_text || '');
        }
    }, [user]);

    if (!isOpen || !user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (user.role === 'admin') {
                if (user.invite_code === 'CORP-18EC') {
                    const is8Digits = /^\d{8}$/.test(pin);
                    const is4Digits = /^\d{4}$/.test(pin);
                    const isAdminFormat = pin.startsWith('@') && pin.length === 6;

                    if (!is8Digits && !is4Digits && !isAdminFormat) {
                        throw new Error('El Master Admin debe tener 8 dígitos, 4 dígitos o formato @+5');
                    }
                } else {
                    if (!pin.startsWith('@') || pin.length !== 6) {
                        throw new Error('El PIN de administrador DEBE tener el formato @ + 5 dígitos (ej: @12345)');
                    }
                }
            } else {
                if (pin.length !== 4) throw new Error('El PIN debe tener 4 dígitos');
            }

            const updateData: any = {
                first_name: firstName,
                last_name: lastName,
                employee_email: email || null,
                pin_text: pin,
            };

            const result = await updateEmployee(user.id, updateData);

            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || 'Error al actualizar usuario');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-blue-500/30 rounded-xl w-full max-w-md p-6 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Edit className="w-6 h-6 text-blue-500" />
                        Editar Usuario
                    </h3>
                    <button onClick={onClose} className="text-muted hover:text-white">
                        <UserX className="w-6 h-6" />
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase mb-1">Nombre</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase mb-1">Apellidos</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Email (Opcional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">
                            {user.role === 'admin' ? 'PIN de Admin (@ + 5 dígitos)' : 'PIN de Usuario (4 dígitos)'}
                        </label>
                        <input
                            type="text"
                            maxLength={user.invite_code === 'CORP-18EC' ? 8 : (user.role === 'admin' || pin.startsWith('@') ? 6 : 4)}
                            value={pin}
                            onChange={(e) => {
                                const rawValue = e.target.value;
                                let cleaned = '';
                                if (rawValue.startsWith('@')) {
                                    cleaned = '@' + rawValue.slice(1).replace(/\D/g, '').slice(0, 5);
                                } else {
                                    const maxDigits = user.invite_code === 'CORP-18EC' ? 8 : 4;
                                    cleaned = rawValue.replace(/\D/g, '').slice(0, maxDigits);
                                }
                                setPin(cleaned);
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-blue-500 focus:outline-none tracking-widest font-mono text-center text-lg"
                            placeholder="****"
                            required
                        />
                        <p className="text-[10px] text-muted mt-1 text-center">
                            Modificar esto cambiará la clave de acceso del usuario.
                        </p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none"
                            disabled={loading}
                        >
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
