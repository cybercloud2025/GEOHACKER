import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { Button } from '../components/ui/Button';
import { rpc } from '../lib/api';
import { motion } from 'framer-motion';
import { Trash2, Edit, FileDown, Shield, UserPlus, LogIn, Eye, RefreshCcw, MapPin, ThumbsUp, Users, Power, UserX, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LiveUserMap } from '../components/Admin/LiveUserMap';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePresenceStore } from '../stores/usePresenceStore';

import hackerIcon from '../assets/hacker-icon.png';
import { ManualModal } from '../components/ManualModal';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { AssignAdminModal } from '../components/Admin/AssignAdminModal';
import { AdminTable } from '../components/Admin/AdminTable';
import { CreateAdminModal, CreateUserModal, EditUserModal } from '../components/Admin/UserModals';

import { UserDetailsModal } from '../components/Admin/UserDetailsModal';


interface LocationData {
    lat: number;
    lng: number;
    accuracy?: number;
}

interface HistoryEntry {
    id: string;
    employee_name: string;
    employee_role: string;
    start_time: string;
    end_time: string | null;
    status: 'active' | 'completed' | 'break';
    start_location: LocationData | null;
    end_location: LocationData | null;
    breaks_count?: number;
    total_break_duration?: string | null;
}

interface AdminUser {
    id: string;
    is_master?: boolean;
    first_name: string;
    last_name: string;
    employee_email?: string | null;
    avatar_url?: string | null;
    invite_code?: string;
    verified: boolean;
    pin_text?: string | null;
    role: string;
    admin_id?: string;
    company_name?: string | null;
    fiscal_id?: string | null;
}



export const AdminPage = () => {
    const {
        logout, employee, token, isRegistrationEnabled, fetchSettings, toggleRegistration,
        verifyEmployee, assignEmployee, setRole, deleteEmployee, impersonate,
        regenerateInviteCode,
    } = useAuthStore();
    const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
    const navigate = useNavigate();
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'history' | 'users' | 'map' | 'admins'>('history');
    // El servidor marca esta bandera al iniciar sesión. Antes se deducía
    // comparando el texto 'CORP-18EC' en tres sitios distintos.
    const isMasterAdmin = employee?.is_master === true;
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<AdminUser | null>(null);
    const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const pdfDocRef = useRef<jsPDF | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [userToAssign, setUserToAssign] = useState<AdminUser | null>(null);
    const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());

    const [userDetailsOpen, setUserDetailsOpen] = useState(false);
    const [selectedUserForDetails, setSelectedUserForDetails] = useState<AdminUser | null>(null);


    // El RPC ya devuelve solo los empleados de esta empresa y excluye a los
    // administradores, así que no hace falta filtrar en el cliente.
    const fetchHistory = useCallback(async () => {
        try {
            const data = await rpc<HistoryEntry[]>('admin_get_history', { p_token: token });
            setHistory(data ?? []);
        } catch (err) {
            console.error('Error al cargar el historial:', err);
        } finally {
            if (view === 'history') setLoading(false);
        }
    }, [view, token]);

    // El aislamiento por empresa lo aplica el servidor: un admin solo recibe
    // sus propios empleados, y el maestro además las altas sin validar.
    const fetchUsers = useCallback(async (shouldSetLoading = true) => {
        if (shouldSetLoading) setLoading(true);
        try {
            const data = await rpc<AdminUser[]>('admin_list_users', { p_token: token });
            setUsers(data ?? []);
        } catch (err) {
            console.error('Error al cargar los usuarios:', err);
        } finally {
            if (shouldSetLoading) setLoading(false);
        }
    }, [token]);

    // Cuenta cualquier turno abierto. Antes filtraba status = 'active', así que
    // quien estaba en pausa aparecía como no fichado.
    const fetchActiveUsers = useCallback(async () => {
        try {
            const ids = await rpc<string[]>('admin_get_active_user_ids', { p_token: token });
            setActiveUserIds(new Set(ids ?? []));
        } catch (err) {
            console.error('Error al cargar los usuarios activos:', err);
        }
    }, [token]);

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        try {
            const data = await rpc<AdminUser[]>('admin_list_admins', { p_token: token });
            setAdmins(data ?? []);
        } catch (err) {
            console.error('Error al cargar los administradores:', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    useEffect(() => {
        setCurrentPage(1);
        if (view === 'history') {
            fetchHistory();
            fetchUsers(false);
            fetchActiveUsers();
            const interval = setInterval(() => {
                fetchHistory();
                fetchActiveUsers();
            }, 5000);
            return () => clearInterval(interval);
        } else if (view === 'users') {
            fetchUsers(true);
            fetchActiveUsers();
            const interval = setInterval(fetchActiveUsers, 5000);
            return () => clearInterval(interval);
        } else if (view === 'admins') {
            fetchAdmins();
        }
    }, [view, fetchHistory, fetchUsers, fetchActiveUsers, fetchAdmins]);

    const toggleUserRole = async (userId: string, currentRole: string, userName: string) => {
        const newRole = currentRole === 'admin' ? 'employee' : 'admin';
        const action = newRole === 'admin' ? 'ASCENDER a ADMINISTRADOR' : 'DEGRADAR a EMPLEADO';

        const confirmed = window.confirm(`¿Estás seguro de que deseas ${action} al usuario "${userName}"? \n\n${newRole === 'admin' ? 'Tendrá acceso total al panel de control.' : 'Perderá el acceso al panel de control.'}`);

        if (!confirmed) return;

        try {
            setLoading(true);
            // Solo el Administrador Maestro puede hacerlo, y lo comprueba el servidor.
            const { success, error } = await setRole(userId, newRole as 'admin' | 'employee');
            if (!success) throw new Error(error);

            await fetchUsers(true);
            if (view === 'admins') await fetchAdmins();
        } catch (err) {
            console.error('Error al cambiar el rol:', err);
            alert(err instanceof Error ? err.message : 'No se pudo cambiar el rol.');
        } finally {
            setLoading(false);
        }
    };


    /**
     * Validar un alta.
     *
     * La generación del código CORP-XXXX y el ascenso a rol admin los hace
     * ahora el servidor dentro de admin_verify_employee, en una transacción.
     * Antes se calculaban en el cliente y se enviaban como un UPDATE suelto.
     */
    const handleVerifyUser = async (user: AdminUser) => {
        // Un empleado sin administrador asignado lo asigna el maestro a mano.
        if (isMasterAdmin && user.role !== 'admin' && !user.admin_id) {
            setUserToAssign(user);
            setIsAssignModalOpen(true);
            return;
        }

        const esAdmin = user.role === 'admin';
        const confirmado = window.confirm(
            esAdmin
                ? `¿Validar al Administrador "${user.first_name} ${user.last_name}"?`
                : `¿Verificar al usuario "${user.first_name} ${user.last_name}"?`
        );
        if (!confirmado) return;

        try {
            setLoading(true);
            const { success, error } = await verifyEmployee(user.id);
            if (!success) throw new Error(error);

            await fetchUsers(true);
            if (esAdmin) await fetchAdmins();
        } catch (err) {
            console.error('Error al validar:', err);
            alert(err instanceof Error ? err.message : 'No se pudo validar el usuario.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmAssign = async (adminId: string) => {
        if (!userToAssign) return;

        try {
            setLoading(true);
            const { success, error } = await assignEmployee(userToAssign.id, adminId);
            if (!success) throw new Error(error);
            await fetchUsers(true);
        } catch (err) {
            console.error('Error al asignar el usuario:', err);
            alert(err instanceof Error ? err.message : 'No se pudo asignar el usuario.');
        } finally {
            setLoading(false);
            setUserToAssign(null);
        }
    };

    const handleDeleteUser = async (userId: string, userName: string) => {
        const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${userName}"? Su historial de fichajes y ubicaciones también se eliminará.`);
        if (!confirmed) return;

        try {
            setLoading(true);
            const { success, error } = await deleteEmployee(userId);
            if (!success) throw new Error(error);

            // Refrescar lista de usuarios
            await fetchUsers(true);

            // Si estamos en la vista de historial, refrescar también ya que los registros podrían haber sido eliminados
            if (view === 'history') {
                await fetchHistory();
            }
            if (view === 'admins') {
                await fetchAdmins();
            }
        } catch (err) {
            console.error('Error al eliminar el usuario:', err);
            alert(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.');
        } finally {
            setLoading(false);
        }
    };

    const calculateDuration = (start: string, end: string | null) => {
        if (!end) return 'En curso...';
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        return `${hrs}h ${mins}m`;
    };


    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };




    const exportToPDF = () => {
        setLoading(true);
        const doc = new jsPDF();

        // Precargar Imagen
        const img = new Image();
        img.src = hackerIcon;

        img.onload = () => {
            // --- CABECERA CYBERPUNK ---
            // 1. Contenedor / Borde (Estilo Cyberpunk)
            doc.setDrawColor(57, 255, 20); // Verde Neón Intenso
            doc.setLineWidth(1.5); // Borde principal más grueso
            doc.rect(5, 5, 200, 45, 'S'); // Rectángulo Exterior

            // Esquinas Decorativas
            doc.setLineWidth(3.0); // Esquinas más gruesas
            // Superior-Izquierda
            doc.line(5, 5, 20, 5);
            doc.line(5, 5, 5, 20);
            // Inferior-Derecha
            doc.line(190, 50, 205, 50);
            doc.line(205, 35, 205, 50);

            // 2. Logo & Title (Left Aligned)
            doc.addImage(img, 'PNG', 12, 12, 25, 25);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(24);
            doc.setTextColor(0, 0, 0); // Negro para el título principal
            doc.text("REPORTE CORPORATIVO", 42, 22);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(220, 38, 38); // Rojo-600 para el subtítulo
            doc.text("SISTEMA DE RASTREO CORPORATIVO", 42, 29);

            // 3. Widget de Reloj "Terminal" (Alineado a la derecha)
            const now = new Date();
            const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

            // Contenedor del reloj
            doc.setDrawColor(203, 213, 225); // Borde Slate-300
            doc.setFillColor(241, 245, 249); // Fondo Slate-100 (Gris Claro)
            doc.roundedRect(145, 12, 55, 30, 1, 1, 'FD');

            doc.setFont("courier", "bold");

            // Etiqueta "SYSTEM TIME"
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // Slate-500
            doc.text("TIEMPO_SISTEMA", 150, 20);

            // Hora Digital Grande
            doc.setFontSize(16);
            doc.setTextColor(239, 68, 68); // Rojo (Mantenemos para acento)
            doc.text(timeStr, 172, 30, { align: 'center' });

            // Fecha
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105); // Slate-600 (Más oscuro para contraste)
            doc.text(dateStr, 172, 38, { align: 'center' });




            const tableColumn = ["Nombre del Empleado", "Correo Electrónico", "Estado", "Código PIN"];
            const tableRows = users.map(user => [
                `${user.first_name} ${user.last_name}`,
                user.employee_email || 'No registrado',
                user.verified ? 'VERIFICADO' : 'TEMPORAL',
                user.pin_text || '----'
            ]);

            // --- GENERACIÓN DE TABLA ---
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 60, // Ajustado para cabecera de 50mm
                theme: 'grid',
                styles: {
                    fontSize: 10,
                    cellPadding: 6,
                    textColor: [51, 65, 85], // Slate-700 (Texto Oscuro)
                    lineColor: [0, 0, 0], // Borde Negro
                    lineWidth: 0.5, // Borde más grueso
                    font: "helvetica",
                    fontStyle: 'bold', // Simular Arial Black
                    fillColor: [255, 255, 255], // Fondo Blanco
                    halign: 'center' // Centrar todo el contenido
                },
                headStyles: {
                    fillColor: [254, 240, 138], // Fondo Amarillo Claro
                    textColor: [220, 38, 38], // Texto Rojo
                    fontSize: 13,
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: 0.5, // Coincidir con el borde grueso
                    lineColor: [0, 0, 0] // Borde Negro para cabecera también
                },
                bodyStyles: {
                    valign: 'middle'
                },
                alternateRowStyles: {
                    fillColor: [241, 245, 249] // Slate-100 (Light Gray)
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 60 }, // Nombre
                    1: { cellWidth: 70, textColor: [100, 116, 139] }, // Email
                    2: { cellWidth: 30 }, // Estado
                    3: { cellWidth: 30, fontStyle: 'italic', textColor: [51, 65, 85] } // PIN
                },
                // --- PIE DE PÁGINA (En cada página) ---
                // --- PIE DE PÁGINA Y BORDE CYBERPUNK (En cada página) ---
                didDrawPage: (data) => {
                    const pageSize = doc.internal.pageSize;
                    const pageHeight = pageSize.height || pageSize.getHeight();
                    const pageWidth = pageSize.width || pageSize.getWidth();
                    const margin = 5;
                    const borderColor = [0, 0, 0];

                    // --- 1. Marco Exterior Principal ---
                    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
                    doc.setLineWidth(1.5);
                    doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), 'S');

                    // --- 2. Esquinas Técnicas (Soportes Gruesos) ---
                    const cornerLen = 15;
                    doc.setLineWidth(3);

                    // Top-Left
                    doc.line(margin, margin + cornerLen, margin, margin);
                    doc.line(margin, margin, margin + cornerLen, margin);

                    // Top-Right
                    doc.line(pageWidth - margin - cornerLen, margin, pageWidth - margin, margin);
                    doc.line(pageWidth - margin, margin, pageWidth - margin, margin + cornerLen);

                    // Bottom-Right
                    doc.line(pageWidth - margin, pageHeight - margin - cornerLen, pageWidth - margin, pageHeight - margin);
                    doc.line(pageWidth - margin, pageHeight - margin, pageWidth - margin - cornerLen, pageHeight - margin);

                    // Bottom-Left
                    doc.line(margin + cornerLen, pageHeight - margin, margin, pageHeight - margin);
                    doc.line(margin, pageHeight - margin, margin, pageHeight - margin - cornerLen);

                    // --- 3. Decoraciones Laterales (Grips) ---
                    const centerY = pageHeight / 2;
                    doc.setFillColor(borderColor[0], borderColor[1], borderColor[2]);

                    // Grip Izquierdo
                    doc.rect(margin - 1.5, centerY - 10, 3, 20, 'F');
                    // Grip Derecho
                    doc.rect(pageWidth - margin - 1.5, centerY - 10, 3, 20, 'F');

                    // --- 4. Texto de Pie de Página ---
                    doc.setFont("courier", "bold");
                    doc.setFontSize(8);

                    // Izquierda: Confidencial
                    doc.setTextColor(239, 68, 68); // Rojo
                    doc.text("EXPORTACIÓN DEL SISTEMA CONFIDENCIAL // ACCESO RESTRINGIDO", margin * 3, pageHeight - (margin * 2));

                    // Derecha: Números de Página
                    doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]); // Número de página negro/verde
                    doc.text(`PÁGINA ${data.pageNumber}`, pageWidth - (margin * 3), pageHeight - (margin * 2), { align: 'right' });
                }
            });

            // Guardar PDF
            doc.save(`reporte_usuarios_${new Date().getTime()}.pdf`);
            setLoading(false);
        };

        img.onerror = () => {
            alert('Error al cargar el logo para el PDF.');
            setLoading(false);
        };
    };

    const generateAdminsPDF = (): Promise<jsPDF> => {
        return new Promise((resolve, reject) => {
            const doc = new jsPDF();
            const img = new Image();
            img.src = hackerIcon;

            img.onload = () => {
                // Fondo de la Cabecera (Cabecera Cyberpunk)
                doc.setFillColor(10, 10, 10);
                doc.rect(0, 0, 210, 55, 'F');

                // --- CABECERA (Mismo estilo) ---
                doc.setDrawColor(57, 255, 20);
                doc.setLineWidth(1.5);
                doc.rect(5, 5, 200, 45, 'S');

                // Decorative Corners
                doc.setLineWidth(3.0);
                // Top-Left
                doc.line(5, 5, 20, 5);
                doc.line(5, 5, 5, 20);
                // Bottom-Right
                doc.line(190, 50, 205, 50);
                doc.line(205, 35, 205, 50);

                doc.addImage(img, 'PNG', 12, 12, 25, 25);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(24);
                doc.setTextColor(0, 0, 0);
                doc.text("REPORTE CORPORATIVO", 42, 22);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(220, 38, 38);
                doc.text("REPORTE DE ADMINISTRADORES", 42, 29);

                // Widget de Reloj
                const now = new Date();
                const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

                doc.setDrawColor(203, 213, 225);
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(145, 12, 55, 30, 1, 1, 'FD');

                doc.setFont("courier", "bold");
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text("SYSTEM_TIME", 150, 20);

                doc.setFontSize(16);
                doc.setTextColor(239, 68, 68);
                doc.text(timeStr, 172, 30, { align: 'center' });

                doc.setFontSize(10);
                doc.setTextColor(71, 85, 105);
                doc.text(dateStr, 172, 38, { align: 'center' });


                // --- DATOS DE LA TABLA ---
                const tableColumn = ["Nombre", "Email", "Estado", "PIN"];
                const tableRows = admins.map(admin => [
                    `${admin.first_name} ${admin.last_name}`,
                    admin.employee_email || 'No registrado',
                    admin.verified ? 'VERIFICADO' : 'TEMPORAL',
                    admin.pin_text || '----',
                ]);

                // --- TABLE GENERATION ---
                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 60,
                    theme: 'grid',
                    styles: {
                        fontSize: 10,
                        cellPadding: 6,
                        textColor: [51, 65, 85],
                        lineColor: [0, 0, 0],
                        lineWidth: 0.5,
                        font: "helvetica",
                        fontStyle: 'bold',
                        fillColor: [255, 255, 255],
                        halign: 'center'
                    },
                    headStyles: {
                        fillColor: [254, 240, 138], // Amarillo para Cabecera de Admin
                        textColor: [220, 38, 38],
                        fontSize: 13,
                        fontStyle: 'bold',
                        halign: 'center',
                        lineWidth: 0.5,
                        lineColor: [0, 0, 0]
                    },
                    bodyStyles: {
                        valign: 'middle'
                    },
                    alternateRowStyles: {
                        fillColor: [241, 245, 249]
                    },
                    // --- PIE DE PÁGINA (En cada página) ---
                    didDrawPage: (data) => {
                        const pageSize = doc.internal.pageSize;
                        const pageHeight = pageSize.height || pageSize.getHeight();
                        const pageWidth = pageSize.width || pageSize.getWidth();
                        const margin = 5;
                        const borderColor = [0, 0, 0];

                        // --- 1. Marco Exterior Principal ---
                        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
                        doc.setLineWidth(1.5);
                        doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), 'S');

                        // --- 2. Esquinas Técnicas ---
                        const cornerLen = 15;
                        doc.setLineWidth(3);
                        // Top-Left
                        doc.line(margin, margin + cornerLen, margin, margin);
                        doc.line(margin, margin, margin + cornerLen, margin);
                        // Top-Right
                        doc.line(pageWidth - margin - cornerLen, margin, pageWidth - margin, margin);
                        doc.line(pageWidth - margin, margin, pageWidth - margin, margin + cornerLen);
                        // Bottom-Right
                        doc.line(pageWidth - margin, pageHeight - margin - cornerLen, pageWidth - margin, pageHeight - margin);
                        doc.line(pageWidth - margin, pageHeight - margin, pageWidth - margin - cornerLen, pageHeight - margin);
                        // Bottom-Left
                        doc.line(margin + cornerLen, pageHeight - margin, margin, pageHeight - margin);
                        doc.line(margin, pageHeight - margin, margin, pageHeight - margin - cornerLen);

                        // --- 3. Side Decorations (Grips) ---
                        const centerY = pageHeight / 2;
                        doc.setFillColor(borderColor[0], borderColor[1], borderColor[2]);
                        doc.rect(margin - 1.5, centerY - 10, 3, 20, 'F');
                        doc.rect(pageWidth - margin - 1.5, centerY - 10, 3, 20, 'F');

                        // --- 4. Bottom Footer Text ---
                        doc.setFont("courier", "bold");
                        doc.setFontSize(8);
                        doc.setTextColor(239, 68, 68);
                        doc.text("LISTA DE ADMINISTRADORES - CONFIDENCIAL", margin * 3, pageHeight - (margin * 2));
                        doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]);
                        doc.text(`PÁGINA ${data.pageNumber}`, pageWidth - (margin * 3), pageHeight - (margin * 2), { align: 'right' });
                    }
                });

                resolve(doc);
            };

            img.onerror = () => {
                reject("Error al cargar activos para el PDF.");
            };
        });
    };

    const openAdminsPdfPreview = async () => {
        setLoading(true);
        try {
            const doc = await generateAdminsPDF();
            pdfDocRef.current = doc;
            // jsPDF devuelve un objeto URL; el modal espera una cadena.
            setPdfPreviewUrl(doc.output('bloburl').toString());
            setIsPdfPreviewOpen(true);
        } catch (error) {
            console.error(error);
            alert('Error al generar la vista previa del PDF.');
        } finally {
            setLoading(false);
        }
    };

    const downloadCurrentPdf = () => {
        if (pdfDocRef.current) {
            pdfDocRef.current.save(`reporte_admins_${new Date().getTime()}.pdf`);
        }
    };



    const toggleSort = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const navigateToMap = (id: string) => {
        navigate(`/admin/map/${id}`);
    };





    return (
        <div className="p-6 md:p-10 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col items-center text-center mb-12 gap-8">
                    <div className="flex flex-col items-center">
                        <h1 className="text-5xl font-black text-white mb-2 tracking-tight">PANEL DE CONTROL</h1>
                        <p className="text-muted font-medium text-lg">Gestión de tiempos y empleados</p>

                        {employee?.invite_code && (
                            <div className="flex flex-col items-center gap-4 mt-6">
                                <div className="bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 inline-flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                                    <span className="text-xs text-primary font-mono uppercase tracking-widest">Tu Código:</span>
                                    <span className="text-sm text-white font-bold tracking-[0.2em] font-mono">{employee?.invite_code}</span>
                                </div>
                                <div
                                    className={`text-2xl font-black font-mono tracking-[0.3em] uppercase drop-shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-pulse ${isMasterAdmin
                                        ? 'text-red-600'
                                        : 'text-[#39FF14] drop-shadow-[0_0_20px_rgba(57,255,20,0.8)]'
                                        }`}
                                    style={{ animationDuration: isMasterAdmin ? undefined : '3s' }}
                                >
                                    {employee?.first_name} {employee?.last_name}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-center gap-4">
                        {isMasterAdmin && (
                            <>
                                <Button
                                    onClick={() => setView('admins')}
                                    variant={view === 'admins' ? 'primary' : 'secondary'}
                                    className="flex items-center gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 h-11"
                                >
                                    <Shield className="w-4 h-4" />
                                    Administradores
                                </Button>
                                <Button
                                    onClick={() => toggleRegistration(!isRegistrationEnabled)}
                                    variant={isRegistrationEnabled ? 'primary' : 'secondary'}
                                    className={`flex items-center gap-2 border-2 transition-all duration-500 h-11 ${isRegistrationEnabled
                                        ? 'border-green-500/50 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                                        : 'border-red-500/50 text-red-500 grayscale opacity-70'
                                        }`}
                                    title={isRegistrationEnabled ? 'Registro de usuarios activado' : 'Registro de usuarios desactivado'}
                                >
                                    <Power className={`w-4 h-4 ${isRegistrationEnabled ? 'animate-pulse' : ''}`} />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">
                                        REGISTRO: {isRegistrationEnabled ? 'ON' : 'OFF'}
                                    </span>
                                </Button>
                            </>
                        )}
                        <Button
                            onClick={() => setIsCreateUserModalOpen(true)}
                            variant="primary"
                            className="flex items-center gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-11"
                        >
                            <UserPlus className="w-4 h-4" />
                            Registrar Usuario
                        </Button>
                        <Button
                            onClick={() => setView('map')}
                            variant={view === 'map' ? 'primary' : 'secondary'}
                            className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 h-11"
                        >
                            <MapPin className="w-4 h-4" />
                            Ubicación de usuarios
                        </Button>
                        <Button
                            onClick={() => setView('users')}
                            variant={view === 'users' ? 'primary' : 'secondary'}
                            className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 h-11"
                        >
                            <Users className="w-4 h-4" />
                            Empleados
                        </Button>
                        <Button
                            onClick={() => setView('history')}
                            variant={view === 'history' ? 'primary' : 'secondary'}
                            className="h-11 border-white/10 text-muted hover:text-white"
                        >
                            Ver Fichajes
                        </Button>
                        <Button
                            onClick={() => {
                                logout();
                                navigate('/');
                            }}
                            variant="secondary"
                            className="hover:bg-red-500/10 hover:text-red-400 border-red-500/30 h-11"
                        >
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>

                {view === 'history' && (
                    <>
                        {/* STATS CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            <div className="p-6 bg-surface/50 backdrop-blur-md border border-white/10 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><Users className="w-12 h-12 text-primary" /></div>

                                {/* Live Indicator */}
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm uppercase tracking-wider text-muted">Activos Ahora</h3>
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400/75 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                </div>

                                <p className="text-4xl font-mono text-primary font-bold">
                                    {history.filter(h => h.status === 'active').length}
                                </p>
                            </div>
                            <div className="p-6 bg-surface/50 backdrop-blur-md border border-white/10 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><UserX className="w-12 h-12 text-red-500" /></div>
                                <h3 className="text-sm uppercase tracking-wider text-muted mb-1">FUERA DE TURNO</h3>
                                <p className="text-4xl font-mono text-green-400 font-bold">
                                    {Math.max(0, users.length - history.filter(h => h.status === 'active').length)}
                                </p>
                            </div>
                        </div>

                        <AdminTable
                            history={history}
                            loading={loading}
                            rowsPerPage={rowsPerPage}
                            currentPage={currentPage}
                            sortOrder={sortOrder}
                            toggleSort={toggleSort}
                            handleRowsPerPageChange={handleRowsPerPageChange}
                            handlePageChange={handlePageChange}
                            navigateToMap={navigateToMap}
                            calculateDuration={calculateDuration}
                        />
                    </>
                )}

                {
                    view === 'users' && (
                        /* USERS VIEW */
                        <div className="bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Lista de Empleados
                                </h3>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setIsCreateUserModalOpen(true)}
                                        variant="primary"
                                        className="h-9 px-4 text-xs flex items-center gap-2"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Crear Empleado
                                    </Button>
                                    <Button
                                        onClick={() => setIsManualModalOpen(true)}
                                        variant="secondary"
                                        className="h-9 px-4 text-xs flex items-center gap-2 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Manual
                                    </Button>
                                    <Button
                                        onClick={exportToPDF}
                                        variant="secondary"
                                        className="h-9 px-4 text-xs flex items-center gap-2 border-primary/20 hover:bg-primary/10"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        PDF
                                    </Button>
                                    <Button
                                        onClick={() => setIsDeleteMode(!isDeleteMode)}
                                        variant={isDeleteMode ? "primary" : "secondary"}
                                        className="h-9 px-4 text-xs flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {isDeleteMode ? 'Cancelar Borrado' : 'Eliminar Usuario'}
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead className="bg-white/5 text-muted text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="p-4 text-center">Nombre Completo</th>
                                            <th className="p-4 text-center">Email</th>
                                            <th className="p-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span>Estado</span>
                                                    <div className="flex gap-2 font-normal lowercase tracking-normal opacity-70">
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Verificado</span>
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> Temporal</span>
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="p-4 text-center text-purple-400 font-black tracking-widest">ROL / ADMIN</th>
                                            <th className="p-4 text-center">PIN</th>
                                            <th className="p-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {loading ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-muted">Cargando usuarios...</td></tr>
                                        ) : users.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-muted">No hay usuarios registrados.</td></tr>
                                        ) : (
                                            users.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((user) => (
                                                <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4 text-left">
                                                        <div className="flex items-center justify-start gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs overflow-hidden border border-white/10 shrink-0">
                                                                {user.avatar_url ? (
                                                                    <img
                                                                        src={user.avatar_url}
                                                                        alt={user.first_name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <>{user.first_name[0]}{user.last_name[0]}</>
                                                                )}
                                                            </div>
                                                            <div className="text-left">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`uppercase tracking-wider font-mono ${user.role === 'admin' ? 'text-[#60A5FA] font-black text-[15px] drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-white font-bold'}`}>
                                                                        {user.first_name} {user.last_name}
                                                                    </div>
                                                                    {onlineUserIds.has(user.id) && (
                                                                        <div title="Conectado a la plataforma">
                                                                            <ThumbsUp className="w-5 h-5 text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                                                                        </div>
                                                                    )}
                                                                    {activeUserIds.has(user.id) && (
                                                                        <div title="Fichado y Trabajando">
                                                                            <MapPin className="w-5 h-5 text-[#39FF14] animate-pulse drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-muted uppercase tracking-tighter">
                                                                    {user.role === 'admin' ? 'Administrador' : 'Empleado'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center text-[#39FF14] text-sm font-medium">
                                                        {user.employee_email || '-'}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${user.verified ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse'}`}>
                                                            {user.verified ? 'VERIFICADO' : 'TEMPORAL'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                                                            {user.role === 'admin' ? 'ADMIN' : 'USUARIO'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-300 font-mono font-bold tracking-[0.2em]">
                                                                {user.pin_text || '----'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center flex items-center justify-center gap-2">
                                                        {isMasterAdmin && !user.verified ? (
                                                            <button
                                                                onClick={() => handleVerifyUser(user)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 border transition-all rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse hover:animate-none group ${user.role === 'admin'
                                                                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                                                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                                                                    }`}
                                                                title={user.role === 'admin' ? "Validar este Administrador" : "Validar y Asignar Usuario"}
                                                            >
                                                                {user.role === 'admin' ? (
                                                                    <>
                                                                        <Shield className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                        Validar Admin
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                        Validar Usuario
                                                                    </>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <>
                                                                {!user.verified && (
                                                                    <button
                                                                        onClick={() => handleVerifyUser(user)}
                                                                        className="p-2 text-green-400 hover:text-green-500 transition-colors rounded-lg hover:bg-green-500/10"
                                                                        title="Verificar Usuario"
                                                                    >
                                                                        <ThumbsUp className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                                {isMasterAdmin && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedUserForDetails(user);
                                                                            setUserDetailsOpen(true);
                                                                        }}
                                                                        className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors rounded-lg hover:bg-cyan-500/10"
                                                                        title="Ver Ficha Completa"
                                                                    >
                                                                        <Eye className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setUserToEdit(user);
                                                                setIsEditUserModalOpen(true);
                                                            }}
                                                            className="p-2 text-emerald-400 hover:text-emerald-500 transition-colors rounded-lg hover:bg-emerald-500/10"
                                                            title="Editar usuario"
                                                        >
                                                            <Edit className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleUserRole(user.id, user.role, `${user.first_name} ${user.last_name}`)}
                                                            className={`p-2 transition-colors rounded-lg ${user.role === 'admin' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-blue-400 hover:bg-blue-400/10'}`}
                                                            title={user.role === 'admin' ? "Degradar a Empleado" : "Ascender a Administrador"}
                                                        >
                                                            <Shield className="w-5 h-5" />
                                                        </button>
                                                        {isDeleteMode && (
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name}`)}
                                                                className="p-2 text-red-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                                                                title="Eliminar usuario"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-white/10 flex flex-col md:flex-row gap-4 justify-between items-center text-xs text-muted">
                                <div className="flex items-center gap-2">
                                    <span>Mostrar filas:</span>
                                    <select
                                        value={rowsPerPage}
                                        onChange={(e) => {
                                            setRowsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-black/40 border border-white/10 rounded p-1 text-white focus:outline-none"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>

                                <div>
                                    Mostrando {Math.min(users.length, (currentPage - 1) * rowsPerPage + 1)} - {Math.min(users.length, currentPage * rowsPerPage)} de {users.length}
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(users.length / rowsPerPage), prev + 1))}
                                        disabled={currentPage >= Math.ceil(users.length / rowsPerPage)}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {view === 'map' && <LiveUserMap />}

                {
                    view === 'admins' && (
                        /* ADMINS VIEW */
                        <div className="bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col mt-6">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-purple-400" />
                                    Lista de Administradores
                                </h3>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setIsCreateAdminModalOpen(true)}
                                        variant="primary"
                                        className="h-9 px-4 text-xs flex items-center gap-2"
                                    >
                                        <Shield className="w-4 h-4" />
                                        Crear Administrador
                                    </Button>
                                    <Button
                                        onClick={() => setIsDeleteMode(!isDeleteMode)}
                                        variant={isDeleteMode ? "primary" : "secondary"}
                                        className="h-9 px-4 text-xs flex items-center gap-2 border-red-500/20 hover:bg-red-500/10 text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {isDeleteMode ? 'Cancelar Borrado' : 'Eliminar Administrador'}
                                    </Button>
                                    <Button
                                        onClick={openAdminsPdfPreview}
                                        variant="secondary"
                                        className="h-9 px-4 text-xs flex items-center gap-2 border-purple-500/20 hover:bg-purple-500/10 text-purple-400"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        PDF Admin
                                    </Button>

                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead className="bg-white/5 text-muted text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="p-4 text-center">Nombre Completo</th>
                                            <th className="p-4 text-center">Email</th>
                                            {isMasterAdmin && <th className="p-4 text-center">CÓDIGO HACKER</th>}
                                            <th className="p-4 text-center">Estado</th>
                                            <th className="p-4 text-center">PIN</th>
                                            <th className="p-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {loading ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-muted">Cargando administradores...</td></tr>
                                        ) : admins.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-muted">No hay administradores registrados.</td></tr>
                                        ) : (
                                            admins.map((admin) => (
                                                <motion.tr
                                                    key={admin.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="hover:bg-white/5 transition-colors"
                                                >
                                                    <td className="p-4 text-left">
                                                        <div className="flex items-center justify-start gap-4">
                                                            {onlineUserIds.has(admin.id) && (
                                                                <div title="Conectado a la plataforma">
                                                                    <ThumbsUp className="w-6 h-6 text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                                                </div>
                                                            )}
                                                            {activeUserIds.has(admin.id) && (
                                                                <div title="Fichado y Trabajando">
                                                                    <MapPin className="w-6 h-6 text-[#39FF14] animate-pulse drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]" />
                                                                </div>
                                                            )}
                                                            <span className="text-lg font-black text-[#60A5FA] font-mono tracking-wider uppercase drop-shadow-[0_0_12px_rgba(96,165,250,0.5)]">
                                                                {admin.first_name} {admin.last_name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-muted text-center">
                                                        {admin.employee_email}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className="px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-purple-300 font-mono font-bold tracking-widest text-xs">
                                                                {admin.invite_code || 'CORP-????'}
                                                            </span>
                                                            {isMasterAdmin && (!admin.invite_code || admin.invite_code.includes('?')) && (
                                                                <button
                                                                    onClick={async () => {
                                                                        // El código único lo genera y comprueba el servidor.
                                                                        try {
                                                                            setLoading(true);
                                                                            const result = await regenerateInviteCode(admin.id);
                                                                            if (!result.success) throw new Error(result.error || 'No se pudo generar el código');
                                                                            await fetchAdmins();
                                                                        } catch (err) {
                                                                            alert(err instanceof Error ? err.message : 'Error al generar el código');
                                                                        } finally {
                                                                            setLoading(false);
                                                                        }
                                                                    }}
                                                                    className="p-1 text-purple-400 hover:text-purple-300 transition-colors"
                                                                    title="Generar Código Real"
                                                                >
                                                                    <RefreshCcw className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${admin.verified ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse'}`}>
                                                            {admin.verified ? 'VERIFICADO' : 'TEMPORAL'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-white font-mono text-center">
                                                        <div className="flex items-center justify-center gap-2 text-cyan-400">
                                                            {admin.pin_text || '----'}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedUserForDetails(admin);
                                                                    setUserDetailsOpen(true);
                                                                }}
                                                                className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors rounded-lg hover:bg-cyan-500/10"
                                                                title="Ver Ficha Completa"
                                                            >
                                                                <Eye className="w-5 h-5" />
                                                            </button>
                                                            {isMasterAdmin && !admin.verified && (
                                                                <button
                                                                    onClick={() => handleVerifyUser(admin)}
                                                                    className="flex items-center gap-2 px-3 py-1.5 border transition-all rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse hover:animate-none group bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                                                                    title="Validar este Administrador"
                                                                >
                                                                    <Shield className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                    Validar Admin
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={async () => {
                                                                    // El servidor emite una sesión nueva para ese admin.
                                                                    const { success, error } = await impersonate(admin.id);
                                                                    if (success) navigate('/');
                                                                    else alert(error || 'No se pudo suplantar al usuario.');
                                                                }}
                                                                className="p-2 text-blue-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-500/10"
                                                                title="Entrar como este administrador"
                                                            >
                                                                <LogIn className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setUserToEdit(admin);
                                                                    setIsEditUserModalOpen(true);
                                                                }}
                                                                className="p-2 text-emerald-400 hover:text-emerald-500 transition-colors rounded-lg hover:bg-emerald-500/10"
                                                                title="Editar administrador"
                                                            >
                                                                <Edit className="w-5 h-5" />
                                                            </button>
                                                            {isDeleteMode && (
                                                                <button
                                                                    onClick={() => handleDeleteUser(admin.id, `${admin.first_name} ${admin.last_name}`)}
                                                                    disabled={admin.is_master === true}
                                                                    className={`p-2 transition-colors rounded-lg ${admin.is_master === true
                                                                        ? 'text-muted cursor-not-allowed opacity-30'
                                                                        : 'text-red-400 hover:text-red-500 hover:bg-red-500/10'}`}
                                                                    title={admin.is_master === true ? "No puedes eliminar al Administrador Maestro" : "Eliminar administrador"}
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }
            </div >

            <CreateAdminModal
                isOpen={isCreateAdminModalOpen}
                onClose={() => setIsCreateAdminModalOpen(false)}
                onSuccess={() => {
                    fetchAdmins();
                    setIsCreateAdminModalOpen(false);
                }}
            />

            <CreateUserModal
                isOpen={isCreateUserModalOpen}
                onClose={() => setIsCreateUserModalOpen(false)}
                onSuccess={() => {
                    fetchUsers(true);
                    setIsCreateUserModalOpen(false);
                }}
            />

            <EditUserModal
                isOpen={isEditUserModalOpen}
                onClose={() => {
                    setIsEditUserModalOpen(false);
                    setUserToEdit(null);
                }}
                onSuccess={() => {
                    fetchUsers(true);
                    fetchAdmins();
                    setIsEditUserModalOpen(false);
                    setUserToEdit(null);
                }}
                user={userToEdit}
            />

            <ManualModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                userCode={employee?.invite_code || ''}
            />

            <PdfPreviewModal
                isOpen={isPdfPreviewOpen}
                onClose={() => setIsPdfPreviewOpen(false)}
                pdfUrl={pdfPreviewUrl}
                onDownload={downloadCurrentPdf}
                title="Vista Previa - Reporte de Administradores"
            />
            <AssignAdminModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onAssign={handleConfirmAssign}
                userName={userToAssign ? `${userToAssign.first_name} ${userToAssign.last_name}` : ''}
            />



            <UserDetailsModal
                isOpen={userDetailsOpen}
                onClose={() => {
                    setUserDetailsOpen(false);
                    setSelectedUserForDetails(null);
                }}
                user={selectedUserForDetails}
                history={history}
            />
        </div >
    );
};

