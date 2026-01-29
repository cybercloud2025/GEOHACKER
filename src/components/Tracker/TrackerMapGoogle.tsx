import { useEffect } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';

interface TrackerMapGoogleProps {
    center: { lat: number; lng: number } | null;
}

// Internal component to handle camera updates
const MapUpdater = ({ center }: { center: { lat: number; lng: number } | null }) => {
    const map = useMap();

    useEffect(() => {
        if (map && center) {
            map.panTo(center);
            map.setZoom(16);
        }
    }, [map, center]);

    return null;
};

export const TrackerMapGoogle = ({ center }: TrackerMapGoogleProps) => {
    const defaultCenter = { lat: 40.024331, lng: -4.4282433 }; // Santa Olalla, Toledo

    return (
        <Map
            style={{ width: '100%', height: '100%' }}
            defaultCenter={defaultCenter}
            defaultZoom={13}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId={'DEMO_MAP_ID'} // You might want to remove or change this for production
        // Dark mode style (optional, can be added later)
        >
            {center && <Marker position={center} />}
            <MapUpdater center={center} />
        </Map>
    );
};
