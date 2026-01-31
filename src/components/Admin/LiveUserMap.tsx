import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Clock, Battery, Zap, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

/* --- GOOGLE MAPS IMPORTS --- */
import { Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { GoogleMapWrapper } from '../GoogleMap/GoogleMapWrapper';

const COLORS = ['#00f7ff', '#ff00ff', '#00ff00', '#ffff00', '#ff4b4b', '#7b2cbf'];
const getUserColor = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLORS[hash % COLORS.length];
};

interface ActiveUserLocation {
    employee_id: string;
    first_name: string;
    last_name: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    heading: number | null;
    speed: number | null;
    battery_level: number | null;
    last_ping: string;
    shift_start_time: string;
    status: string;
    has_gps: boolean;
    avatar_url?: string | null;
}

// Helper component to auto-fit bounds
const MapBoundsFitter = ({ locations }: { locations: ActiveUserLocation[] }) => {
    const map = useMap();

    useEffect(() => {
        if (!map || locations.length === 0) return;

        // Access google from window to avoid TS errors
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as any).google;
        if (!g) return;

        const bounds = new g.maps.LatLngBounds();
        let hasPoints = false;

        locations.forEach(loc => {
            if (loc.has_gps) {
                bounds.extend({ lat: loc.latitude, lng: loc.longitude });
                hasPoints = true;
            }
        });

        if (hasPoints) {
            map.fitBounds(bounds);
            // Optional: Adjust zoom if too close or only 1 marker
            const listener = g.maps.event.addListenerOnce(map, "idle", () => {
                if (map.getZoom() > 16) map.setZoom(16);
            });
            return () => g.maps.event.removeListener(listener);
        }
    }, [map, locations]);

    return null;
};

export const LiveUserMap = () => {
    const [locations, setLocations] = useState<ActiveUserLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [now, setNow] = useState<Date>(new Date());
    const [selectedUser, setSelectedUser] = useState<ActiveUserLocation | null>(null);

    // Update 'now' every second for the cronometro
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const calculateElapsed = (startTime: string) => {
        const start = new Date(startTime).getTime();
        const diff = now.getTime() - start;
        if (diff < 0) return '00:00:00';

        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);

        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const fetchLiveLocations = async () => {
        try {
            // STEP 1: Get all active time entries directly (joining employee data)
            const { data: activeShifts } = await supabase
                .from('time_entries')
                .select('id, employee_id, start_time, status, employees(first_name, last_name, role, avatar_url)')
                .is('end_time', null);

            if (!activeShifts || activeShifts.length === 0) {
                setLocations([]);
                return;
            }

            // Process active shifts
            const filteredShifts = activeShifts;

            if (filteredShifts.length === 0) {
                setLocations([]);
                return;
            }

            // STEP 2: For each active shift, fetch the latest known location
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results = await Promise.all(filteredShifts.map(async (shift: any) => {
                const { data: latestLoc } = await supabase
                    .from('locations')
                    .select('*')
                    .eq('time_entry_id', shift.id)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                return {
                    employee_id: shift.employee_id,
                    first_name: shift.employees.first_name,
                    last_name: shift.employees.last_name,
                    latitude: latestLoc?.latitude || 0,
                    longitude: latestLoc?.longitude || 0,
                    accuracy: latestLoc?.accuracy || 0,
                    heading: latestLoc?.heading || null,
                    speed: latestLoc?.speed || null,
                    battery_level: latestLoc?.battery_level || null,
                    last_ping: latestLoc?.timestamp || shift.start_time,
                    shift_start_time: shift.start_time,
                    status: shift.status,
                    has_gps: !!latestLoc,
                    avatar_url: shift.employees.avatar_url
                } as ActiveUserLocation;
            }));

            setLocations(results);
            setLastRefresh(new Date());
        } catch (err: unknown) {
            console.error('Error fetching live locations:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLiveLocations();
        const interval = setInterval(fetchLiveLocations, 20000); // Refresh every 20s
        return () => clearInterval(interval);
    }, []);

    const defaultCenter = { lat: 40.024331, lng: -4.4282433 }; // Santa Olalla, Toledo

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] w-full bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header / Toolbar */}
            <div className="h-14 bg-white/5 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-white font-bold uppercase tracking-tight flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-primary animate-pulse" />
                        Mapa en Tiempo Real
                    </h2>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-muted uppercase tracking-widest">
                        {locations.length} activos
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right flex items-center gap-2">
                        <p className="text-[10px] text-muted uppercase">Actualizado:</p>
                        <p className="text-xs font-mono text-primary">{format(lastRefresh, 'HH:mm:ss')}</p>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-grow relative bg-gray-900 border-b border-white/5">
                {locations.length === 0 && !loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
                        <div className="text-center p-8 border border-white/10 bg-surface/50 rounded-2xl max-w-sm">
                            <MapPin className="w-12 h-12 text-muted mx-auto mb-4 opacity-20" />
                            <h2 className="text-xl font-bold text-white mb-2">Sin Actividad</h2>
                            <p className="text-muted text-sm pb-4">
                                No hay empleados con turno activo en este momento.
                            </p>
                        </div>
                    </div>
                )}

                {loading && locations.length === 0 && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 pointer-events-none">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                <GoogleMapWrapper>
                    <Map
                        style={{ width: '100%', height: '100%' }}
                        defaultCenter={defaultCenter}
                        defaultZoom={6}
                        gestureHandling={'greedy'}
                        disableDefaultUI={false}
                        mapId={'ADMIN_LIVE_MAP'}
                    >
                        <MapBoundsFitter locations={locations} />

                        {locations.filter(l => l.has_gps).map((loc) => (
                            <AdvancedMarker
                                key={loc.employee_id}
                                position={{ lat: loc.latitude, lng: loc.longitude }}
                                title={`${loc.first_name} ${loc.last_name}`}
                                onClick={() => setSelectedUser(loc)}
                            />
                        ))}

                        {selectedUser && (
                            <InfoWindow
                                position={{ lat: selectedUser.latitude, lng: selectedUser.longitude }}
                                onCloseClick={() => setSelectedUser(null)}
                                minWidth={200}
                                pixelOffset={[0, -30]}
                            >
                                <div className="p-1 min-w-[200px]">
                                    <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs overflow-hidden border border-white/10"
                                            style={{ backgroundColor: !selectedUser.avatar_url ? `${getUserColor(selectedUser.employee_id)}20` : undefined, color: !selectedUser.avatar_url ? getUserColor(selectedUser.employee_id) : undefined }}>
                                            {selectedUser.avatar_url ? (
                                                <img src={selectedUser.avatar_url} alt={selectedUser.first_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <>{selectedUser.first_name.charAt(0)}{selectedUser.last_name.charAt(0)}</>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 leading-none">{selectedUser.first_name} {selectedUser.last_name}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                <p className="text-[10px] text-green-600 font-bold uppercase tracking-tighter">
                                                    En Turno: <span className="font-mono">{calculateElapsed(selectedUser.shift_start_time)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <Clock className="w-3 h-3" />
                                                <span>Último GPS:</span>
                                            </div>
                                            <span className="font-mono text-gray-700">
                                                {format(new Date(selectedUser.last_ping), 'HH:mm:ss')}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <Zap className="w-3 h-3" />
                                                <span>Velocidad:</span>
                                            </div>
                                            <span className="font-mono text-gray-700">
                                                {selectedUser.speed ? `${(selectedUser.speed * 3.6).toFixed(1)} km/h` : '0 km/h'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <Battery className="w-3 h-3" />
                                                <span>Batería:</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-8 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${selectedUser.battery_level && selectedUser.battery_level < 20 ? 'bg-red-500' : 'bg-green-500'}`}
                                                        style={{ width: `${selectedUser.battery_level || 100}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono text-gray-700">{selectedUser.battery_level || 100}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </InfoWindow>
                        )}
                    </Map>
                </GoogleMapWrapper>
            </div>

            {/* List Table Area (Bottom) */}
            <div className="h-48 bg-black/40 backdrop-blur-lg border-t border-white/10 overflow-hidden flex flex-col shrink-0">
                <div className="px-4 py-2 bg-white/5 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-muted">
                    <span>Lista de Empleados en Turno</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {locations.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted italic">
                            No hay empleados en turno activo.
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-black/40 text-[9px] uppercase text-muted sticky top-0">
                                <tr>
                                    <th className="p-3">Empleado</th>
                                    <th className="p-3">Estado</th>
                                    <th className="p-3">Tiempo</th>
                                    <th className="p-3">GPS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {locations.map((loc) => (
                                    <tr key={loc.employee_id}
                                        className="hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => {
                                            if (!loc.has_gps) return;
                                            setSelectedUser(loc);
                                            // Ideally we would also pan the map here, but without easy access to map ref outside, 
                                            // we rely on clicking the marker or the auto-bounds.
                                            // To improve: Expose setCenter/setZoom via context or prop if needed.
                                        }}>
                                        <td className="p-3 flex items-center gap-2">
                                            <div
                                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm overflow-hidden border border-white/10"
                                                style={{ backgroundColor: !loc.avatar_url ? getUserColor(loc.employee_id) : undefined }}
                                            >
                                                {loc.avatar_url ? (
                                                    <img src={loc.avatar_url} alt={loc.first_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <>{loc.first_name.charAt(0)}{loc.last_name.charAt(0)}</>
                                                )}
                                            </div>
                                            <span className="text-xs text-white font-medium">{loc.first_name} {loc.last_name}</span>
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold border border-green-500/20">
                                                {loc.status === 'active' ? 'ACTIVO' : 'PAUSA'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-xs text-primary">
                                            {calculateElapsed(loc.shift_start_time)}
                                        </td>
                                        <td className="p-3">
                                            {loc.has_gps ? (
                                                <span className="text-cyan-400 text-[10px] flex items-center gap-1">
                                                    <Zap className="w-3 h-3" /> OK
                                                </span>
                                            ) : (
                                                <span className="text-red-500 text-[10px] flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3 opacity-50" /> NO SIG.
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
