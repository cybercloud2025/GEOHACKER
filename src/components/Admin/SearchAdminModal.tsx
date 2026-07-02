import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Building2, CreditCard, Mail, Hash, Lock } from 'lucide-react';

interface AdminUser {
    id: string;
    first_name: string;
    last_name: string;
    employee_email?: string | null;
    avatar_url?: string | null;
    invite_code?: string;
    verified: boolean;
    pin_text?: string | null;
    role: string;
    company_name?: string | null;
    fiscal_id?: string | null;
}

interface SearchAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    admins: AdminUser[];
}

export const SearchAdminModal = ({ isOpen, onClose, admins }: SearchAdminModalProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [foundAdmin, setFoundAdmin] = useState<AdminUser | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setFoundAdmin(null);
            setHasSearched(false);
        }
    }, [isOpen]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        const term = searchTerm.toLowerCase().trim();
        const found = admins.find(admin =>
            (admin.first_name?.toLowerCase().includes(term)) ||
            (admin.last_name?.toLowerCase().includes(term)) ||
            (`${admin.first_name} ${admin.last_name}`.toLowerCase().includes(term)) ||
            (admin.invite_code?.toLowerCase() === term) ||
            (admin.company_name?.toLowerCase().includes(term))
        );

        setFoundAdmin(found || null);
        setHasSearched(true);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-lg bg-[#0a0a0a] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden"
                >
                    {/* Header Cyberpunk */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-8">
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/10 mb-4 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                <Search className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tight">BASE DE DATOS ADMIN</h2>
                            <p className="text-cyan-400/60 text-sm font-mono mt-1 tracking-wider uppercase">Búsqueda Clasificada</p>
                        </div>

                        <form onSubmit={handleSearch} className="relative mb-8">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nombre, Código Hacker o Empresa..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 pl-12 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
                                autoFocus
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                            <button
                                type="submit"
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors border border-cyan-500/30"
                            >
                                Buscar
                            </button>
                        </form>

                        {hasSearched && !foundAdmin && (
                            <div className="text-center py-8 border border-dashed border-red-500/20 rounded-xl bg-red-500/5">
                                <p className="text-red-400 font-mono text-sm">SIN COINCIDENCIAS EN LA RED</p>
                            </div>
                        )}

                        {foundAdmin && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                            >
                                {/* Info Header */}
                                <div className="p-4 bg-white/5 border-b border-white/5 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center shrink-0">
                                        {foundAdmin.avatar_url ? (
                                            <img src={foundAdmin.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                            <span className="text-lg font-bold text-white">{foundAdmin.first_name[0]}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-none">{foundAdmin.first_name} {foundAdmin.last_name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">ADMIN</span>
                                            {foundAdmin.verified && <span className="text-[10px] text-green-400 flex items-center gap-1">● Verificado</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Info Grid */}
                                <div className="p-4 grid grid-cols-1 gap-3">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 group hover:border-cyan-500/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded bg-white/5 text-gray-400 group-hover:text-cyan-400 transition-colors"><Mail className="w-4 h-4" /></div>
                                                <div className="text-sm">
                                                    <p className="text-xs text-muted uppercase tracking-wider">Email Corporativo</p>
                                                    <p className="text-white font-mono">{foundAdmin.employee_email || 'No registrado'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 group hover:border-purple-500/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded bg-white/5 text-gray-400 group-hover:text-purple-400 transition-colors"><Hash className="w-4 h-4" /></div>
                                                <div className="text-sm">
                                                    <p className="text-xs text-muted uppercase tracking-wider">Código Hacker</p>
                                                    <p className="text-purple-300 font-mono font-bold tracking-widest">{foundAdmin.invite_code || 'PENDIENTE'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 group hover:border-green-500/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded bg-white/5 text-gray-400 group-hover:text-green-400 transition-colors"><Lock className="w-4 h-4" /></div>
                                                <div className="text-sm">
                                                    <p className="text-xs text-muted uppercase tracking-wider">PIN de Acceso</p>
                                                    <p className="text-white font-mono tracking-widest">****</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Company Fields */}
                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                            <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                                <div className="flex items-center gap-2 mb-1 text-blue-300">
                                                    <Building2 className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase">Empresa</span>
                                                </div>
                                                <p className="text-white text-sm font-medium truncate" title={foundAdmin.company_name || ''}>
                                                    {foundAdmin.company_name || 'N/A'}
                                                </p>
                                            </div>

                                            <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                                <div className="flex items-center gap-2 mb-1 text-amber-300">
                                                    <CreditCard className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase">ID Fiscal</span>
                                                </div>
                                                <p className="text-white text-sm font-mono truncate">
                                                    {foundAdmin.fiscal_id || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
