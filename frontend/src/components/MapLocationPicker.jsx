import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './MapLocationPicker.css';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const DEFAULT_CENTER = [34.0, 9.0];
const DEFAULT_ZOOM = 6;
const POINT_ZOOM = 14;

/** Tuiles OSM France : toponymes et style adaptés à la francophonie */
const OSM_FR_TILES = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
const OSM_FR_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.fr/copyright" rel="noopener">OpenStreetMap France</a> &mdash; ' +
    'données &copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener">les contributeurs OSM</a>';

/**
 * Carte OpenStreetMap : clic pour placer le marqueur (siège / localisation).
 * @param {number | null | undefined} latitude
 * @param {number | null | undefined} longitude
 * @param {(coords: { latitude: number; longitude: number }) => void} onLocationChange
 */
const MapLocationPicker = ({
    latitude,
    longitude,
    onLocationChange,
    height = 380,
    className = '',
    hint = 'Cliquez sur la carte pour indiquer l’emplacement sur le terrain.',
}) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onChangeRef = useRef(onLocationChange);

    useEffect(() => {
        onChangeRef.current = onLocationChange;
    }, [onLocationChange]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || mapRef.current) return undefined;

        const hasPoint =
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            !Number.isNaN(latitude) &&
            !Number.isNaN(longitude);
        const center = hasPoint ? [latitude, longitude] : DEFAULT_CENTER;
        const zoom = hasPoint ? POINT_ZOOM : DEFAULT_ZOOM;

        const map = L.map(el, { scrollWheelZoom: true }).setView(center, zoom);
        mapRef.current = map;

        L.tileLayer(OSM_FR_TILES, {
            attribution: OSM_FR_ATTRIBUTION,
            maxZoom: 20,
            subdomains: 'abc',
        }).addTo(map);

        if (hasPoint) {
            markerRef.current = L.marker([latitude, longitude]).addTo(map);
        }

        map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            } else {
                markerRef.current = L.marker([lat, lng]).addTo(map);
            }
            onChangeRef.current?.({ latitude: lat, longitude: lng });
        });

        const ro = new ResizeObserver(() => {
            map.invalidateSize();
        });
        ro.observe(el);

        requestAnimationFrame(() => {
            map.invalidateSize();
        });
        const sizeTimer = window.setTimeout(() => map.invalidateSize(), 400);

        return () => {
            window.clearTimeout(sizeTimer);
            ro.disconnect();
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const hasPoint =
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            !Number.isNaN(latitude) &&
            !Number.isNaN(longitude);

        if (hasPoint) {
            if (markerRef.current) {
                markerRef.current.setLatLng([latitude, longitude]);
            } else {
                markerRef.current = L.marker([latitude, longitude]).addTo(map);
            }
            map.setView([latitude, longitude], Math.max(map.getZoom(), POINT_ZOOM));
        }
    }, [latitude, longitude]);

    return (
        <div className={`mlp-root ${className}`.trim()} lang="fr">
            <p className="mlp-hint">{hint}</p>
            <div
                ref={containerRef}
                className="mlp-map"
                style={{ height: typeof height === 'number' ? `${height}px` : height }}
                role="application"
                lang="fr"
                aria-label="Carte pour choisir la localisation"
            />
            {typeof latitude === 'number' && typeof longitude === 'number' && !Number.isNaN(latitude) && !Number.isNaN(longitude) && (
                <p className="mlp-coords" aria-live="polite">
                    {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
            )}
        </div>
    );
};

export default MapLocationPicker;
