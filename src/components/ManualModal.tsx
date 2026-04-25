import React, { useState } from 'react';
import { X, Download, Shield, User, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import jsPDF from 'jspdf';

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
    userCode: string; // The admin's invite code to display
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose, userCode }) => {
    const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin');

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        // --- Background & Theme ---
        // Header
        doc.setFillColor(20, 20, 20);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setFont("helvetica", "bold");
        doc.setTextColor(57, 255, 20); // Neon Green
        doc.setFontSize(22);
        doc.text("PROTOCOLO DE SEGURIDAD", margin, 20);
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("SISTEMA DE CÓDIGOS DE ORGANIZACIÓN", margin, 32);

        // --- Step 1: Verification ---
        let y = 60;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text("PASO 1: REGISTRO Y VERIFICACIÓN", margin, y);
        y += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Los nuevos usuarios entran en estado 'Temporal'. Como Admin,", margin, y);
        y += 6;
        doc.text("debes validarlos manualmente en tu panel para activar el rastreo.", margin, y);
        y += 15;

        // Graphic: Code Box
        doc.setFillColor(30, 41, 59); // Slate-800
        doc.setDrawColor(6, 182, 212); // Cyan
        doc.rect(margin, y, 100, 20, 'FD');
        doc.setTextColor(6, 182, 212); // Cyan
        doc.setFont("courier", "bold");
        doc.setFontSize(10);
        doc.text("TU CÓDIGO MAESTRO:", margin + 5, y + 8);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text(userCode || "CORP-XXXX", margin + 5, y + 16);

        // Label
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("Este código vincula al equipo directamente contigo.", margin + 110, y + 12);

        y += 40;

        // --- Step 2: Privacy ---
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("PASO 2: PRIVACIDAD TOTAL", margin, y);
        y += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("La ubicación SOLO se registra durante el horario laboral activo.", margin, y);
        y += 6;
        doc.text("Al hacer 'Check-Out', el sistema apaga todo rastreo de GPS.", margin, y);
        y += 15;

        // Graphic: Form Simulation
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, y, 120, 40); // Container

        doc.setFontSize(10);
        doc.text("ESTADO DEL RASTREO", margin + 5, y + 10);

        doc.setDrawColor(57, 255, 20); // Green
        doc.rect(margin + 5, y + 15, 110, 8);
        doc.text("TRABAJANDO: GPS ACTIVADO", margin + 10, y + 21);

        doc.setDrawColor(220, 38, 38); // Red
        doc.rect(margin + 5, y + 25, 110, 8);
        doc.text("FUERA DE TURNO: GPS APAGADO", margin + 10, y + 31);

        y += 60;

        // --- Step 3: Support ---
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("PASO 3: SOPORTE Y GESTIÓN", margin, y);
        y += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Usa el panel 'Ubicación' para ver a tu equipo en tiempo real.", margin, y);
        y += 6;
        doc.text("Puedes editar perfiles o resetear PINs desde la lista de usuarios.", margin, y);


        // Footer
        doc.setFont("courier", "bold");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("GENERADO AUTOMÁTICAMENTE POR EL SISTEMA // " + new Date().toLocaleDateString(), margin, pageHeight - 10);

        doc.save("manual_protocolo_seguridad.pdf");
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-[#111]">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-tr from-blue-500 to-purple-600 p-2 rounded-lg">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Manual de Usuario</h2>
                                <p className="text-sm text-gray-400">Guía interactiva de registro e identificación</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-800">
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors relative ${activeTab === 'admin' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Shield className="w-4 h-4" /> ADMINISTRADORES
                            </span>
                            {activeTab === 'admin' && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('employee')}
                            className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors relative ${activeTab === 'employee' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <User className="w-4 h-4" /> EMPLEADOS
                            </span>
                            {activeTab === 'employee' && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                            )}
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-[#050505]">
                        <AnimatePresence mode="wait">
                            {activeTab === 'admin' ? (
                                <motion.div
                                    key="admin"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-8"
                                >
                                    {/* Step 1 */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">1</span>
                                            <h3 className="text-lg font-bold text-purple-400">Control de Acceso</h3>
                                        </div>
                                        <p className="text-gray-400 ml-11 text-sm leading-relaxed">
                                            Como Administrador, gestionas tu propia red. Los nuevos registros aparecerán como <strong className="text-yellow-500 uppercase">Temporales</strong> hasta que tú los valides manualmente en la pestaña de Usuarios.
                                        </p>

                                        <div className="ml-11 grid md:grid-cols-2 gap-6">
                                            {/* Form Mockup */}
                                            <div className="bg-[#111] border border-gray-800 p-4 rounded-lg space-y-3">
                                                <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Flujo de Validación</div>
                                                <div className="bg-yellow-500/10 h-8 rounded px-3 flex items-center text-xs text-yellow-500 border border-yellow-500/20 animate-pulse">
                                                    <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span> Usuario Temporal (Pendiente)
                                                </div>
                                                <div className="flex justify-center text-gray-600 text-[10px]">VERIFICACIÓN MANUAL</div>
                                                <div className="bg-green-500/10 h-8 rounded px-3 flex items-center text-xs text-green-500 border border-green-500/20">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span> Usuario Verificado (Acceso Total)
                                                </div>
                                            </div>

                                            {/* PIN Format Info */}
                                            <div className="bg-[#111] border border-purple-900/30 p-4 rounded-lg flex flex-col justify-center relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <Shield className="w-24 h-24 text-purple-500" />
                                                </div>
                                                <div className="text-xs font-bold text-purple-400 mb-4 uppercase tracking-wider">Identidad Maestra</div>
                                                <div className="text-3xl font-mono text-white font-bold text-center mb-4 tracking-wider">
                                                    @{userCode ? userCode.split('-')[1] : 'HACKER'}
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center text-xs text-gray-400 gap-2">
                                                        <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-[10px]">✓</div>
                                                        Tu PIN empieza por <strong className="text-white">@</strong>
                                                    </div>
                                                    <div className="flex items-center text-xs text-gray-400 gap-2">
                                                        <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-[10px]">✓</div>
                                                        Acceso total a <strong className="text-white">Geo-Localización</strong>.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">2</span>
                                            <h3 className="text-lg font-bold text-purple-400">Código de Organización Maestro</h3>
                                        </div>
                                        <div className="ml-11 grid md:grid-cols-2 gap-6 items-center">
                                            <p className="text-gray-400 text-sm leading-relaxed">
                                                Tu código <strong className="text-white">{userCode || 'CORP-XXXX'}</strong> vincula automáticamente a los empleados con tu panel. <br /><br />
                                                Si se registran sin código, el <strong className="text-red-500">Master Admin</strong> deberá asignarlos a tu red manualmente.
                                            </p>
                                            <div className="bg-[#0f0f13] border border-gray-800 p-6 rounded-lg text-center relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent"></div>
                                                <div className="relative z-10">
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Tu Enlace Corporativo</div>
                                                    <div className="text-3xl font-black font-mono text-white tracking-[0.2em] mb-2">{userCode || 'CORP-XXXX'}</div>
                                                    <div className="inline-block px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] border border-purple-500/20">Compártelo con tu equipo</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </motion.div>
                            ) : (
                                <motion.div
                                    key="employee"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-8"
                                >
                                    {/* Employee Instructions - Step 1 */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">1</span>
                                            <h3 className="text-lg font-bold text-blue-400">Registro Simplificado</h3>
                                        </div>
                                        <p className="text-gray-400 ml-11 text-sm leading-relaxed">
                                            Los empleados tienen dos formas de unirse: <br />
                                            1. Usando tu <strong className="text-white">Código</strong> (vinculación directa).<br />
                                            2. Registro <strong className="text-white">Público</strong> (esperando validación del Master Admin).
                                        </p>

                                        <div className="ml-11 bg-[#111] border border-gray-800 p-6 rounded-lg max-w-md">
                                            <div className="space-y-4">
                                                <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded text-[10px] text-yellow-500 text-center uppercase tracking-widest">
                                                    Modo: Usuario Temporal
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 block mb-1">PIN de 4 dígitos</label>
                                                    <div className="h-8 bg-gray-900 rounded border border-gray-700 w-24 flex items-center justify-center font-mono text-white">****</div>
                                                </div>
                                                <div className="relative">
                                                    <label className="text-xs text-blue-400 font-bold block mb-1">Código de Red (Opcional)</label>
                                                    <div className="h-10 bg-blue-900/10 rounded border border-blue-500/50 w-full flex items-center justify-center text-blue-400 font-mono font-bold tracking-widest">
                                                        {userCode || 'CORP-XXXX'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">2</span>
                                            <h3 className="text-lg font-bold text-blue-400">Privacidad y Fichaje</h3>
                                        </div>
                                        <p className="text-gray-400 ml-11 text-sm leading-relaxed">
                                            Tu ubicación solo es compartida con tu administrador <strong className="text-white">DURANTE EL TURNO</strong>. <br /><br />
                                            Al finalizar la jornada (Check-Out), el rastreo se desactiva totalmente para garantizar tu privacidad fuera del horario laboral.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-800 bg-[#111] flex justify-between items-center">
                        <Button
                            variant="secondary"
                            className="bg-transparent border border-gray-700 bg-gray-800/20 text-gray-300 hover:text-white"
                            onClick={handleDownloadPDF}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Descargar PDF
                        </Button>
                        <Button onClick={onClose} className="bg-cyan-600 hover:bg-cyan-700 px-8">
                            Entendido
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
