import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Users, ArrowUpDown, Trash2, UserX, MapPin, Shield, FileText, FileDown, Power, UserPlus, Edit, LogIn, ThumbsUp, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LiveUserMap } from '../components/Admin/LiveUserMap';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePresenceStore } from '../stores/usePresenceStore';

import hackerIcon from '../assets/hacker-icon.png';
import { ManualModal } from '../components/ManualModal';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { AssignAdminModal } from '../components/Admin/AssignAdminModal';

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

export const AdminPage = () => {
    const { logout, employee, isRegistrationEnabled, fetchSettings, toggleRegistration } = useAuthStore();
    const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
    const navigate = useNavigate();
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'history' | 'users' | 'map' | 'admins'>('history');
    const isMasterAdmin = ((employee as any)?.invite_code || '').toUpperCase() === 'CORP-18EC';
    const [admins, setAdmins] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<any>(null);
    const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const pdfDocRef = useRef<any>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [userToAssign, setUserToAssign] = useState<any>(null);
    const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchSettings();
    }, []);

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
    }, [view]);

    const fetchHistory = async () => {
        try {
            const { data, error } = await supabase.rpc('get_all_time_entries');
            if (error) throw error;

            setHistory(data || []);
        } finally {
            if (view === 'history') setLoading(false);
        }
    };

    const fetchUsers = async (shouldSetLoading = true) => {
        if (shouldSetLoading) setLoading(true);
        try {
            let query = supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: false });

            if (isMasterAdmin) {
                query = query.or(`admin_id.eq.${employee?.id},verified.eq.false`);
            } else {
                query = query.neq('role', 'admin').eq('admin_id', employee?.id);
            }

            const { data, error } = await query;

            if (error) throw error;
            setUsers(data || []);
        } finally {
            if (shouldSetLoading) setLoading(false);
        }
    };

    const fetchActiveUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('time_entries')
                .select('employee_id')
                .eq('status', 'active');

            if (error) throw error;
            const activeIds = new Set<string>((data || []).map(item => item.employee_id));
            setActiveUserIds(activeIds);
        } catch (err) {
            console.error('Error fetching active users:', err);
        }
    };

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: false });

            // Admins: role is admin OR has admin PIN prefix
            query = query.or(`role.eq.admin,pin_text.ilike.@%`);

            const { data, error } = await query;

            if (error) throw error;
            setAdmins(data || []);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserRole = async (userId: string, currentRole: string, userName: string) => {
        const newRole = currentRole === 'admin' ? 'employee' : 'admin';
        const action = newRole === 'admin' ? 'ASCENDER a ADMINISTRADOR' : 'DEGRADAR a EMPLEADO';

        const confirmed = window.confirm(`¿Estás seguro de que deseas ${action} al usuario "${userName}"? \n\n${newRole === 'admin' ? 'Tendrá acceso total al panel de control.' : 'Perderá el acceso al panel de control.'}`);

        if (!confirmed) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('employees')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            // Refresh users list
            await fetchUsers(true);
        } catch (err) {
            console.error('Error updating role:', err);
            alert('Hubo un error al cambiar el rol. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };


    const handleVerifyUser = async (user: any) => {
        if (isMasterAdmin) {
            const isAdmin = user.role === 'admin' || (user.pin_text && user.pin_text.startsWith('@'));
            if (isAdmin) {
                const confirmed = window.confirm(`¿Validar al Administrador "${user.first_name} ${user.last_name}"?`);
                if (!confirmed) return;

                try {
                    setLoading(true);

                    const updateData: any = { verified: true };

                    // Generate CORP-XXXX code if they are an admin (by role or pin prefix) AND don't have a valid one
                    const isAdminByPin = (user.pin_text?.startsWith('@'));
                    if ((user.role === 'admin' || isAdminByPin) && (!user.invite_code || user.invite_code.includes('?'))) {
                        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                        updateData.invite_code = `CORP-${randomSuffix}`;
                    }

                    // Explicitly set role to admin if they used an @ PIN but weren't marked as admin yet
                    if (isAdminByPin && user.role !== 'admin') {
                        updateData.role = 'admin';
                    }

                    const { error } = await useAuthStore.getState().updateEmployee(user.id, updateData);
                    if (error) throw error;

                    alert(`Administrador ${user.first_name} ha sido validado.${updateData.invite_code ? `\nCódigo asignado: ${updateData.invite_code}` : ''}`);

                    await fetchUsers(true);
                    await fetchAdmins();
                    return;
                }
                catch (err: any) {
                    alert('Error: ' + err.message);
                    setLoading(false);
                    return;
                }
            }
            setUserToAssign(user);
            setIsAssignModalOpen(true);
            return;
        }

        const confirmed = window.confirm(`¿Verificar al usuario "${user.first_name} ${user.last_name}"?`);
        if (!confirmed) return;

        try {
            setLoading(true);
            const { error } = await useAuthStore.getState().updateEmployee(user.id, { verified: true });
            if (error) throw error;
            await fetchUsers(true);
        } catch (err: any) {
            console.error('Error verifying user:', err);
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmAssign = async (adminId: string) => {
        if (!userToAssign) return;

        try {
            setLoading(true);
            const { error } = await useAuthStore.getState().updateEmployee(userToAssign.id, {
                admin_id: adminId,
                verified: true
            });
            if (error) throw error;
            await fetchUsers(true);
        } catch (err: any) {
            console.error('Error assigning and verifying user:', err);
            alert('Error: ' + err.message);
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
            const { error } = await supabase
                .from('employees')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            // Refresh users list
            await fetchUsers(true);

            // If we are in history view, refresh that too since records might have been deleted
            if (view === 'history') {
                await fetchHistory();
            }
            if (view === 'admins') {
                await fetchAdmins();
            }
        } catch (err) {
            console.error('Error deleting user:', err);
            alert('Hubo un error al eliminar el usuario. Inténtalo de nuevo.');
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

    // Sorting Logic
    const sortedHistory = [...history].sort((a, b) => {
        const dateA = new Date(a.start_time).getTime();
        const dateB = new Date(b.start_time).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Pagination Logic
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = sortedHistory.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(sortedHistory.length / rowsPerPage);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };



    const exportToPDF = () => {
        const doc = new jsPDF();

        // Preload Image
        const img = new Image();
        img.src = hackerIcon;

        img.onload = () => {
            // --- CYBERPUNK HEADER ---
            // 1. Container / Border (Cyberpunk Style)
            doc.setDrawColor(57, 255, 20); // Intense Neon Green Border
            doc.setLineWidth(1.5); // Thicker main border
            doc.rect(5, 5, 200, 45, 'S'); // Outer Rectangle (Stroke only)

            // Decorative Corners
            doc.setLineWidth(3.0); // Thicker corners
            // Top-Left
            doc.line(5, 5, 20, 5);
            doc.line(5, 5, 5, 20);
            // Bottom-Right
            doc.line(190, 50, 205, 50);
            doc.line(205, 35, 205, 50);

            // 2. Logo & Title (Left Aligned)
            doc.addImage(img, 'PNG', 12, 12, 25, 25);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(24);
            doc.setTextColor(0, 0, 0); // Black for "GEO HACKER"
            doc.text("GEO HACKER", 42, 22);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(220, 38, 38); // Red-600 for subtitle
            doc.text("SISTEMA DE RASTREO CORPORATIVO", 42, 29);

            // 3. "Terminal" Clock Widget (Right Aligned)
            const now = new Date();
            const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

            // Clock Container
            doc.setDrawColor(203, 213, 225); // Slate-300 Border
            doc.setFillColor(241, 245, 249); // Slate-100 Background (Light Gray)
            doc.roundedRect(145, 12, 55, 30, 1, 1, 'FD');

            doc.setFont("courier", "bold");

            // "SYSTEM TIME" Label
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // Slate-500
            doc.text("SYSTEM_TIME", 150, 20);

            // Large Digital Time
            doc.setFontSize(16);
            doc.setTextColor(239, 68, 68); // Red (Keep for accent)
            doc.text(timeStr, 172, 30, { align: 'center' });

            // Date
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105); // Slate-600 (Darker for contrast)
            doc.text(dateStr, 172, 38, { align: 'center' });




            const tableColumn = ["Nombre del Empleado", "Correo Electrónico", "Estado", "Código PIN"];
            const tableRows = users.map(user => [
                `${user.first_name} ${user.last_name}`,
                user.employee_email || 'No registrado',
                user.verified ? 'VERIFICADO' : 'TEMPORAL',
                user.pin_text || '----'
            ]);

            // --- TABLE GENERATION ---
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 60, // Adjusted for 50mm header
                theme: 'grid',
                styles: {
                    fontSize: 10,
                    cellPadding: 6,
                    textColor: [51, 65, 85], // Slate-700 (Dark Text)
                    lineColor: [0, 0, 0], // Black Border
                    lineWidth: 0.5, // Thicker Border
                    font: "helvetica",
                    fontStyle: 'bold', // Simulate Arial Black
                    fillColor: [255, 255, 255], // White Background
                    halign: 'center' // Center all content
                },
                headStyles: {
                    fillColor: [254, 240, 138], // Light Yellow Background
                    textColor: [220, 38, 38], // Red Text
                    fontSize: 13,
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: 0.5, // Match thicker border
                    lineColor: [0, 0, 0] // Black Border for header too
                },
                bodyStyles: {
                    valign: 'middle'
                },
                alternateRowStyles: {
                    fillColor: [241, 245, 249] // Slate-100 (Light Gray)
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 60 }, // Name
                    1: { cellWidth: 70, textColor: [100, 116, 139] }, // Email
                    2: { cellWidth: 30 }, // Estado
                    3: { cellWidth: 30, fontStyle: 'italic', textColor: [51, 65, 85] } // PIN
                },
                // --- FOOTER (On every page) ---
                // --- FOOTER & CYBERPUNK BORDER (On every page) ---
                didDrawPage: (data) => {
                    const pageSize = doc.internal.pageSize;
                    const pageHeight = pageSize.height || pageSize.getHeight();
                    const pageWidth = pageSize.width || pageSize.getWidth();
                    const margin = 5;
                    const borderColor = [0, 0, 0];

                    // --- 1. Main Outer Frame ---
                    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
                    doc.setLineWidth(1.5);
                    doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), 'S');

                    // --- 2. Technical Corners (Thick Brackets) ---
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

                    // Left Grip
                    doc.rect(margin - 1.5, centerY - 10, 3, 20, 'F');
                    // Right Grip
                    doc.rect(pageWidth - margin - 1.5, centerY - 10, 3, 20, 'F');

                    // --- 4. Bottom Footer Text ---
                    doc.setFont("courier", "bold");
                    doc.setFontSize(8);

                    // Left: Confidential
                    doc.setTextColor(239, 68, 68); // Red
                    doc.text("EXPORTACIÓN DEL SISTEMA CONFIDENCIAL // ACCESO RESTRINGIDO", margin * 3, pageHeight - (margin * 2));

                    // Right: Page Numbers
                    doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]); // Green page num
                    doc.text(`PÁGINA ${data.pageNumber}`, pageWidth - (margin * 3), pageHeight - (margin * 2), { align: 'right' });
                }
            });

            // Save PDF
            doc.save(`reporte_usuarios_${new Date().getTime()}.pdf`);
        };

        img.onerror = () => {
            alert('Error al cargar el logo para el PDF.');
        };
    };

    const generateAdminsPDF = (): Promise<any> => {
        return new Promise((resolve, reject) => {
            const doc = new jsPDF();
            const img = new Image();
            img.src = hackerIcon;

            img.onload = () => {
                // Header Background (Cyberpunk header)
                doc.setFillColor(10, 10, 10);
                doc.rect(0, 0, 210, 55, 'F');

                // --- HEADER (Same style) ---
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
                doc.text("GEO HACKER", 42, 22);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(220, 38, 38);
                doc.text("REPORTE DE ADMINISTRADORES", 42, 29);

                // Clock Widget
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


                // --- TABLE DATA ---
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
                        fillColor: [254, 240, 138], // Yellow for Admin Header
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
                    // --- FOOTER (On every page) ---
                    didDrawPage: (data) => {
                        const pageSize = doc.internal.pageSize;
                        const pageHeight = pageSize.height || pageSize.getHeight();
                        const pageWidth = pageSize.width || pageSize.getWidth();
                        const margin = 5;
                        const borderColor = [0, 0, 0];

                        // --- 1. Main Outer Frame ---
                        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
                        doc.setLineWidth(1.5);
                        doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), 'S');

                        // --- 2. Technical Corners ---
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
        try {
            const doc = await generateAdminsPDF();
            pdfDocRef.current = doc;
            setPdfPreviewUrl(doc.output('bloburl'));
            setIsPdfPreviewOpen(true);
        } catch (error) {
            console.error(error);
            alert('Error al generar la vista previa del PDF.');
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
                        <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Panel de Control</h1>
                        <p className="text-muted font-medium text-lg">Gestión de tiempos y empleados</p>

                        {(employee as any)?.invite_code && (
                            <div className="flex flex-col items-center gap-4 mt-6">
                                <div className="bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 inline-flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                                    <span className="text-xs text-primary font-mono uppercase tracking-widest">Tu Código:</span>
                                    <span className="text-sm text-white font-bold tracking-[0.2em] font-mono">{(employee as any).invite_code}</span>
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
                            onClick={() => setView(view === 'history' ? 'users' : 'history')}
                            variant="primary"
                            className="h-11 shadow-glow-primary"
                        >
                            {view === 'history' ? 'Ver Usuarios' : 'Ver Historial'}
                        </Button>
                        <Button
                            onClick={() => {
                                logout();
                                window.location.reload();
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

                        {/* HISTORY TABLE */}
                        <div className="bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">Historial de Fichajes</h2>
                                <div className="flex items-center gap-4">
                                    {/* Rows Selector */}
                                    <select
                                        value={rowsPerPage}
                                        onChange={handleRowsPerPageChange}
                                        className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-muted focus:outline-none focus:border-primary"
                                    >
                                        <option value={10}>10 filas</option>
                                        <option value={20}>20 filas</option>
                                        <option value={50}>50 filas</option>
                                        <option value={100}>100 filas</option>
                                    </select>

                                    {/* Sort Button */}
                                    <button
                                        onClick={toggleSort}
                                        className="flex items-center gap-2 h-8 px-3 rounded text-xs font-medium transition-all
                                            bg-white/5 hover:bg-white/10 border border-white/10 text-white
                                            hover:border-primary/50 hover:text-primary hover:shadow-[0_0_10px_rgba(0,247,255,0.2)]
                                        "
                                    >
                                        <ArrowUpDown className="w-3 h-3" />
                                        <span>{sortOrder === 'asc' ? 'Antiguos' : 'Recientes'}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-center">
                                    <thead className="bg-white/5 text-muted text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="p-4 text-center">Estado</th>
                                            <th className="p-4 text-center">Empleado</th>
                                            <th className="p-4 text-center">Fecha</th>
                                            <th className="p-4 text-center">Entrada</th>
                                            <th className="p-4 text-center">Salida</th>
                                            <th className="p-4 text-center">Duración</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {loading ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-muted">Cargando datos...</td></tr>
                                        ) : history.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-muted">No hay registros aún.</td></tr>
                                        ) : (
                                            currentRows.map((entry) => (
                                                <motion.tr
                                                    key={entry.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="hover:bg-white/5 transition-colors group"
                                                >
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => entry.start_location && navigateToMap(entry.id)}
                                                            className={`flex h-4 w-4 relative mx-auto transition-transform ${entry.start_location ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}`}
                                                            title={entry.start_location ? "Ver mapa de este turno" : "Sin datos GPS"}
                                                        >
                                                            {entry.status === 'active' ? (
                                                                <>
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                                                                </>
                                                            ) : (
                                                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="p-4 text-white text-center">
                                                        <span className="font-bold">{entry.employee_name}</span>
                                                    </td>
                                                    <td className="p-4 text-muted">
                                                        {format(new Date(entry.start_time), 'dd MMM yyyy', { locale: es })}
                                                    </td>
                                                    <td className="p-4 text-cyan-300 font-mono text-sm">
                                                        {format(new Date(entry.start_time), 'HH:mm')}
                                                    </td>
                                                    <td className="p-4 text-purple-300 font-mono text-sm">
                                                        {entry.end_time ? format(new Date(entry.end_time), 'HH:mm') : '-'}
                                                    </td>
                                                    <td className="p-4 text-white/70 text-sm">
                                                        {calculateDuration(entry.start_time, entry.end_time)}
                                                    </td>
                                                </motion.tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* PAGINATION CONTROLS */}
                            <div className="p-4 border-t border-white/10 flex justify-between items-center bg-white/5">
                                <p className="text-xs text-muted">
                                    Mostrando {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, history.length)} de {history.length}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        Anterior
                                    </Button>
                                    <div className="flex items-center gap-1 px-2">
                                        <span className="text-xs font-mono text-white">Pág {currentPage} / {totalPages}</span>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        </div>
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
                                            <tr><td colSpan={5} className="p-8 text-center text-muted">Cargando usuarios...</td></tr>
                                        ) : users.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted">No hay usuarios registrados.</td></tr>
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
                                                                    {user.role === 'admin' || (user.pin_text && user.pin_text.startsWith('@')) ? 'Administrador' : 'Empleado'}
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
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${user.role === 'admin' || (user.pin_text && user.pin_text.startsWith('@')) ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                                                            {user.role === 'admin' || (user.pin_text && user.pin_text.startsWith('@')) ? 'ADMIN' : 'USUARIO'}
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
                                                                className={`flex items-center gap-2 px-3 py-1.5 border transition-all rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse hover:animate-none group ${user.role === 'admin' || (user.pin_text && user.pin_text.startsWith('@'))
                                                                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                                                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                                                                    }`}
                                                                title={user.role === 'admin' || (user.pin_text && user.pin_text.startsWith('@')) ? "Validar este Administrador" : "Validar y Asignar Usuario"}
                                                            >
                                                                {user.role === 'admin' || (user.pin_text && user.pin_text.startsWith('@')) ? (
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
                                                        ) : !user.verified && (
                                                            <button
                                                                onClick={() => handleVerifyUser(user)}
                                                                className="p-2 text-green-400 hover:text-green-500 transition-colors rounded-lg hover:bg-green-500/10"
                                                                title="Verificar Usuario"
                                                            >
                                                                <ThumbsUp className="w-5 h-5" />
                                                            </button>
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
                                            <tr><td colSpan={5} className="p-8 text-center text-muted">Cargando administradores...</td></tr>
                                        ) : admins.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted">No hay administradores registrados.</td></tr>
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
                                                                        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                                                                        const newCode = `CORP-${randomSuffix}`;
                                                                        try {
                                                                            setLoading(true);
                                                                            const { error } = await useAuthStore.getState().updateEmployee(admin.id, { invite_code: newCode });
                                                                            if (error) throw error;
                                                                            await fetchAdmins();
                                                                        } catch (err: any) {
                                                                            alert('Error: ' + err.message);
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
                                                                onClick={() => handleVerifyUser(admin)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 border transition-all rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse hover:animate-none group ${!admin.verified
                                                                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                                                                    : 'hidden'
                                                                    }`}
                                                                title="Validar este Administrador"
                                                            >
                                                                <Shield className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                Validar Admin
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    useAuthStore.getState().impersonate(admin);
                                                                    window.location.reload();
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
                                                                    disabled={(admin.invite_code || '').toUpperCase() === 'CORP-18EC'}
                                                                    className={`p-2 transition-colors rounded-lg ${(admin.invite_code || '').toUpperCase() === 'CORP-18EC'
                                                                        ? 'text-muted cursor-not-allowed opacity-30'
                                                                        : 'text-red-400 hover:text-red-500 hover:bg-red-500/10'}`}
                                                                    title={(admin.invite_code || '').toUpperCase() === 'CORP-18EC' ? "No puedes eliminar al Administrador Maestro" : "Eliminar administrador"}
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
                userCode={(employee as any)?.invite_code}
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
        </div>
    );
};

interface CreateAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateAdminModal = ({ isOpen, onClose, onSuccess }: CreateAdminModalProps) => {
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

const CreateUserModal = ({ isOpen, onClose, onSuccess }: CreateUserModalProps) => {
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

            // Pass the current admin's invite code to register this user as THEIR employee
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

const EditUserModal = ({ isOpen, onClose, onSuccess, user }: EditUserModalProps) => {
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
            // Validations
            // Validations
            if (user.role === 'admin') {
                // Master Admin Exception: Can have 8 digits (Secret), 4 digits, or @ format
                if (user.invite_code === 'CORP-18EC') {
                    // Allow 8 digits, 4 digits, or @+5
                    const is8Digits = /^\d{8}$/.test(pin);
                    const is4Digits = /^\d{4}$/.test(pin);
                    const isAdminFormat = pin.startsWith('@') && pin.length === 6;

                    if (!is8Digits && !is4Digits && !isAdminFormat) {
                        throw new Error('El Master Admin debe tener 8 dígitos, 4 dígitos o formato @+5');
                    }
                } else {
                    // Normal Admins MUST have @+5
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
                                    // Check if Master Admin to allow 8 digits
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

