import { useEffect } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

interface LocationData {
    lat: number;
    lng: number;
    accuracy?: number;
}

interface AdminMapGoogleProps {
    startLocation: LocationData | null;
    endLocation: LocationData | null;
    employeeName: string;
}

// Internal component to handle camera updates (bounds)
const MapUpdater = ({ start, end }: { start: LocationData | null, end: LocationData | null }) => {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        // Access google from window to avoid TS errors if types aren't perfect
        const g = (window as any).google;
        if (!g) return;

        const bounds = new g.maps.LatLngBounds();
        let hasPoints = false;

        if (start) {
            bounds.extend({ lat: start.lat, lng: start.lng });
            hasPoints = true;
        }
        if (end) {
            bounds.extend({ lat: end.lat, lng: end.lng });
            hasPoints = true;
        }

        if (hasPoints) {
            map.fitBounds(bounds);
            // If only one point (e.g. only start), zoom might be too far out or too close. 
            // Google Maps handles single point fitBounds by zooming to max, so we might want to adjust logic if needed.
            // But usually fitBounds is fine. 
            if (!end) {
                map.setZoom(15);
                map.panTo({ lat: start!.lat, lng: start!.lng });
            }
        }
    }, [map, start, end]);

    return null;
};

export const AdminMapGoogle = ({ startLocation, endLocation, employeeName }: AdminMapGoogleProps) => {
    const defaultCenter = { lat: 40.024331, lng: -4.4282433 }; // Santa Olalla, Toledo

    return (
        <Map
            style={{ width: '100%', height: '100%' }}
            defaultCenter={defaultCenter}
            defaultZoom={13}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId={'ADMIN_MAP_ID'}
        >
            {startLocation && (
                <AdvancedMarker
                    position={{ lat: startLocation.lat, lng: startLocation.lng }}
                    title={`Entrada: ${employeeName}`}
                >
                    <div className="bg-green-500 text-white rounded-full px-2 py-1 text-[10px] font-bold border-2 border-white shadow-xl">
                        IN
                    </div>
                </AdvancedMarker>
            )}

            {endLocation && (
                <AdvancedMarker
                    position={{ lat: endLocation.lat, lng: endLocation.lng }}
                    title={`Salida: ${employeeName}`}
                >
                    <div className="bg-red-500 text-white rounded-full px-2 py-1 text-[10px] font-bold border-2 border-white shadow-xl">
                        OUT
                    </div>
                </AdvancedMarker>
            )}

            <MapUpdater start={startLocation} end={endLocation} />
        </Map>
    );
};
