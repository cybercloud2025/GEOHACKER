/**
 * Acceso tipado al objeto global `google` que inyecta el script de Maps.
 *
 * El proyecto no instala `@types/google.maps`, así que antes cada componente
 * hacía su propio `(window as any).google`. Aquí se declara solo lo que la app
 * usa de verdad, con tipos reales.
 */

export interface LatLngLiteral {
    lat: number;
    lng: number;
}

interface LatLngBounds {
    extend(punto: LatLngLiteral): void;
}

export interface GoogleMapsGlobal {
    maps: {
        LatLngBounds: new () => LatLngBounds;
        event: {
            addListenerOnce(instancia: unknown, evento: string, callback: () => void): unknown;
            removeListener(referencia: unknown): void;
        };
    };
}

/** Devuelve el global de Google Maps, o undefined si el script aún no cargó. */
export const getGoogleMaps = (): GoogleMapsGlobal | undefined =>
    (window as unknown as { google?: GoogleMapsGlobal }).google;
