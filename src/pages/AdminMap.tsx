import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, MapPin } from 'lucide-react';

/* --- GOOGLE MAPS IMPORTS --- */
import { GoogleMapWrapper } from '../components/GoogleMap/GoogleMapWrapper';
import { AdminMapGoogle } from '../components/Admin/AdminMapGoogle';



import { Button } from '../components/ui/Button';

interface LocationData {
    lat: number;
    lng: number;
    accuracy?: number;
}

interface HistoryEntry {
    id: string;
    employee_name: string;
    start_time: string;
    end_time: string | null;
    status: string;
    start_location: LocationData | null;
    end_location: LocationData | null;
}

export const AdminMapPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [entry, setEntry] = useState<HistoryEntry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        fetchEntry();
    }, [id]);

    const fetchEntry = async () => {
        try {
            setLoading(true);
            // We reuse the RPC or query directly since we need detail of ONE entry
            // For simplicity, let's query the view or function results if possible
            // But get_all_time_entries returns everything. Let's query directly or use the same RPC and filter.
            const { data, error } = await supabase.rpc('get_all_time_entries');
            if (error) throw error;

            const found = data.find((d: HistoryEntry) => d.id === id);
            if (found) {
                setEntry(found);
            }
        } catch (err) {
            console.error('Error fetching entry details:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-[#0a0a0a] text-white flex-col gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="font-mono text-primary animate-pulse">CARGANDO RECURSOS GEO...</p>
        </div>
    );

    if (!entry || !entry.start_location) {
        console.warn("No hay datos GPS para esta entrada");
        return (
            <div className="h-screen flex items-center justify-center bg-background text-white text-center p-6">
                <div className="max-w-md w-full p-8 border border-red-500/30 bg-red-500/5 rounded-2xl">
                    <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2 uppercase tracking-tighter text-red-500">Sin Datos Satelitales</h2>
                    <p className="text-muted text-sm mb-6">
                        Este registro no tiene coordenadas guardadas. <br />
                        <span className="text-xs text-white/40 mt-2 block">ID: {id}</span>
                    </p>
                    <Button onClick={() => navigate('/admin')} className="w-full">Volver al Panel</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-[#050505] overflow-hidden">
            {/* Ultra Visible Header */}
            <div className="h-16 bg-primary flex items-center justify-between px-6 z-[9999] shadow-[0_4px_20px_rgba(0,247,255,0.3)] shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 bg-black/20 rounded hover:bg-black/40 text-black">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-black font-black uppercase italic tracking-tighter">
                        PANEL DE MAPA // {entry.employee_name}
                    </h1>
                </div>
                <div className="font-mono text-[10px] text-black bg-black/10 px-2 py-1 rounded">
                    ID: {entry.id.substring(0, 8)}...
                </div>
            </div>

            {/* Map Area - Forced Height */}
            <div className="flex-grow relative bg-gray-900 border-t border-primary/20">
                {/* Overlay removed for clarity */}
                {/* <div className="absolute inset-0 bg-primary/5 pointer-events-none z-10 animate-pulse"></div> */}

                {/* --- GOOGLE MAPS BLOCK --- */}
                <GoogleMapWrapper>
                    <AdminMapGoogle
                        startLocation={entry.start_location}
                        endLocation={entry.end_location}
                        employeeName={entry.employee_name}
                    />
                </GoogleMapWrapper>


            </div>

            {/* Footer Debug */}
            <div className="h-10 bg-black border-t border-white/5 flex items-center px-4 justify-between text-[10px] text-muted font-mono shrink-0">
                <span>LAT: {entry.start_location.lat}</span>
                <span>LNG: {entry.start_location.lng}</span>
                <span className="text-green-500 uppercase">SAT-LINK: ACTIVE</span>
            </div>
        </div>
    );
};
