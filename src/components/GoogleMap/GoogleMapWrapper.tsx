import React from 'react';
import { Link } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useConfig } from '../../lib/config';

interface GoogleMapWrapperProps {
    children: React.ReactNode;
}

export const GoogleMapWrapper: React.FC<GoogleMapWrapperProps> = ({ children }) => {
    // La clave se lee de la configuración del navegador, así que el mapa
    // aparece en cuanto el usuario la guarda, sin recompilar nada.
    const { googleMapsApiKey } = useConfig();

    if (!googleMapsApiKey) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white p-6 text-center">
                <div className="max-w-sm">
                    <h3 className="text-lg font-bold mb-2 text-cyan-400 uppercase tracking-wider">
                        Mapa no disponible
                    </h3>
                    <p className="text-sm opacity-70 mb-4">
                        Falta la API key de Google Maps. El resto de la aplicación funciona con normalidad.
                    </p>
                    <Link
                        to="/configuracion"
                        className="inline-block px-4 py-2 border border-cyan-500/40 text-cyan-400 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/10 transition-colors"
                    >
                        Añadir clave
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <APIProvider apiKey={googleMapsApiKey}>
            {children}
        </APIProvider>
    );
};
