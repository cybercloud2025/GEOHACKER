import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Search, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';

interface Admin {
    id: string;
    first_name: string;
    last_name: string;
    employee_email: string;
    invite_code: string;
}

interface AssignAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (adminId: string) => void;
    userName: string;
}

export const AssignAdminModal = ({ isOpen, onClose, onAssign, userName }: AssignAdminModalProps) => {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchNormalAdmins();
        }
    }, [isOpen]);

    const fetchNormalAdmins = async () => {
        setLoading(true);
        try {
            // Fetch admins that are NOT Master Admin (excluding CORP-18EC)
            const { data, error } = await supabase
                .from('employees')
                .select('id, first_name, last_name, employee_email, invite_code')
                .eq('role', 'admin')
                .neq('invite_code', 'CORP-18EC') // Exclude Master Admin
                .order('first_name', { ascending: true });

            if (error) throw error;
            setAdmins(data || []);
        } catch (err) {
            console.error('Error fetching admins:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredAdmins = admins.filter(admin =>
        `${admin.first_name} ${admin.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.employee_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirm = () => {
        if (selectedAdminId) {
            onAssign(selectedAdminId);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-primary" />
                                    Asignar Administrador
                                </h3>
                                <p className="text-sm text-muted mt-1">Asigna a <span className="text-white font-semibold">{userName}</span> a un administrador encargado.</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-muted hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-white/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Admin List */}
                        <div className="max-h-[350px] overflow-y-auto p-4 space-y-2">
                            {loading ? (
                                <div className="text-center py-10 text-muted animate-pulse">Cargando administradores...</div>
                            ) : filteredAdmins.length === 0 ? (
                                <div className="text-center py-10 text-muted">No se encontraron administradores.</div>
                            ) : (
                                filteredAdmins.map((admin) => (
                                    <button
                                        key={admin.id}
                                        onClick={() => setSelectedAdminId(admin.id)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${selectedAdminId === admin.id
                                            ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                            : 'bg-white/5 border-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${selectedAdminId === admin.id ? 'bg-primary text-black' : 'bg-white/10 text-white'
                                            }`}>
                                            {admin.first_name[0]}{admin.last_name[0]}
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="text-white font-bold">{admin.first_name} {admin.last_name}</div>
                                            <div className="text-xs text-muted flex items-center gap-2 mt-1">
                                                <span className="font-mono text-primary/70">{admin.invite_code}</span>
                                                <span>•</span>
                                                <span className="truncate">{admin.employee_email}</span>
                                            </div>
                                        </div>
                                        {selectedAdminId === admin.id && (
                                            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                                <Check className="w-4 h-4 text-black" />
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={onClose}
                                className="flex-1"
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleConfirm}
                                disabled={!selectedAdminId}
                                className="flex-1"
                            >
                                Confirmar y Verificar
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
