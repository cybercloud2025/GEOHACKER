import { motion } from 'framer-motion';
import { X, Download, FileText } from 'lucide-react';

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string | null;
    onDownload: () => void;
    title?: string;
}

export const PdfPreviewModal = ({ isOpen, onClose, pdfUrl, onDownload, title = "Vista Previa del Reporte" }: PdfPreviewModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-400" />
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-muted hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body - Iframe Preview */}
                <div className="flex-1 bg-white/5 p-4 relative overflow-hidden">
                    {pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            className="w-full h-full rounded border border-white/10 bg-white"
                            title="PDF Preview"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted">
                            <span className="animate-pulse">Generando vista previa...</span>
                        </div>
                    )}
                </div>

                {/* Footer - Actions */}
                <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-slate-900 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/5 transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={onDownload}
                        className="px-6 py-2 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Descargar PDF
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
