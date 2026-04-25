import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '../ui/Button';

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

interface AdminTableProps {
    history: HistoryEntry[];
    loading: boolean;
    rowsPerPage: number;
    currentPage: number;
    sortOrder: 'asc' | 'desc';
    toggleSort: () => void;
    handleRowsPerPageChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    handlePageChange: (newPage: number) => void;
    navigateToMap: (id: string) => void;
    calculateDuration: (start: string, end: string | null) => string;
}

export const AdminTable = ({
    history,
    loading,
    rowsPerPage,
    currentPage,
    sortOrder,
    toggleSort,
    handleRowsPerPageChange,
    handlePageChange,
    navigateToMap,
    calculateDuration
}: AdminTableProps) => {

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

    return (
        <div className="bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Historial de Fichajes</h2>
                <div className="flex items-center gap-4">
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
    );
};
