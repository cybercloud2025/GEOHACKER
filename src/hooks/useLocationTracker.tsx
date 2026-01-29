import { useEffect, useRef } from 'react';
import { useTimeStore } from '../stores/useTimeStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';

// Config
const GPS_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
};

const MIN_DISTANCE_METERS = 10; // Only record if moved X meters

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d * 1000;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

export const useLocationTracker = () => {
    const { status, currentShiftId, updateLocation, lastKnownLocation } = useTimeStore();
    const { employee } = useAuthStore();

    // Refs to access latest state inside the callback without restarting the watcher
    const stateRef = useRef({ status, currentShiftId, employee, lastKnownLocation });

    // Update refs whenever state changes
    useEffect(() => {
        stateRef.current = { status, currentShiftId, employee, lastKnownLocation };
    }, [status, currentShiftId, employee, lastKnownLocation]);

    const watchId = useRef<number | null>(null);

    useEffect(() => {
        // START TRACKING condition
        if (status === 'active' && 'geolocation' in navigator) {


            watchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    // Access latest state from Ref
                    const { currentShiftId, employee, lastKnownLocation } = stateRef.current;

                    const { latitude, longitude, accuracy, heading, speed } = position.coords;
                    const timestamp = position.timestamp;

                    const newCoords = { latitude, longitude, accuracy, timestamp };

                    // 1. Always update local state for UI
                    updateLocation(newCoords);

                    // 2. Decide if we send to DB (Debounce/Distance filter)
                    // Logic: Send if:
                    // a) We haven't verified sending for this specific Shift ID yet (Force first ping of shift)
                    // b) We moved enough distance

                    let shouldSend = false;
                    const lastSentShiftId = sessionStorage.getItem('lastSentShiftId');

                    if (currentShiftId && lastSentShiftId !== currentShiftId) {
                        shouldSend = true;

                    } else if (!lastKnownLocation) {
                        shouldSend = true;
                    } else {
                        const dist = getDistanceFromLatLonInMeters(
                            lastKnownLocation.latitude, lastKnownLocation.longitude,
                            latitude, longitude
                        );

                        // Default check: Moved more than 10 meters
                        if (dist > MIN_DISTANCE_METERS) {
                            shouldSend = true;
                        }
                    }

                    if (shouldSend && currentShiftId && employee) {
                        const { error } = await supabase.from('locations').insert({
                            employee_id: employee.id,
                            time_entry_id: currentShiftId,
                            latitude,
                            longitude,
                            accuracy,
                            heading,
                            speed,
                            battery_level: 100 // Placeholder
                        });

                        if (error) {
                            console.error('Error saving location:', error);
                        } else {
                            // Mark this shift as having received a ping
                            sessionStorage.setItem('lastSentShiftId', currentShiftId);
                        }
                    }
                },
                (error) => {
                    console.error('Error getting location:', error);
                },
                GPS_OPTIONS
            );

        } else {
            // STOP TRACKING
            if (watchId.current !== null) {

                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
        }

        // Cleanup on unmount
        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
            }
        };
    }, [status]); // Only re-run if status changes (active/idle)

    return { isTracking: !!watchId.current };
};
