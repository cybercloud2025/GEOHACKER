import React from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface GoogleMapWrapperProps {
    children: React.ReactNode;
}

export const GoogleMapWrapper: React.FC<GoogleMapWrapperProps> = ({ children }) => {
    if (!API_KEY || API_KEY === 'YOUR_KEY_HERE') {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white p-4 text-center">
                <div>
                    <h3 className="text-xl font-bold mb-2">Falta la API Key de Google Maps</h3>
                    <p className="text-sm opacity-80">
                        Configura <code>VITE_GOOGLE_MAPS_API_KEY</code> en tu archivo <code>.env</code>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <APIProvider apiKey={API_KEY}>
            {children}
        </APIProvider>
    );
};
