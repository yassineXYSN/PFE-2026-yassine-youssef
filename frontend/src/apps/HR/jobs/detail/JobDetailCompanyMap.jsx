import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

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

const OSM_FR_TILES = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
const OSM_FR_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.fr/copyright" rel="noopener">OpenStreetMap France</a> &mdash; ' +
    'données &copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener">les contributeurs OSM</a>';

function hasValidCoords(lat, lng) {
    const la = Number(lat);
    const lo = Number(lng);
    return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

/**
 * Carte du siège : Leaflet si lat/lng enregistrés, sinon iframe Google à partir de l’adresse texte.
 */
export default function JobDetailCompanyMap({ company, addressText }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);

    const lat = company?.latitude ?? company?.lat;
    const lng = company?.longitude ?? company?.lng;
    const coordsOk = hasValidCoords(lat, lng);
    const popupLabel = (addressText && addressText.trim()) || company?.name || 'Siège social';

    useEffect(() => {
        if (!coordsOk) return undefined;
        const el = containerRef.current;
        if (!el) return undefined;

        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        const la = Number(lat);
        const lo = Number(lng);
        const map = L.map(el, { scrollWheelZoom: false, attributionControl: true }).setView([la, lo], 15);
        mapRef.current = map;

        L.tileLayer(OSM_FR_TILES, {
            attribution: OSM_FR_ATTRIBUTION,
            maxZoom: 19,
            subdomains: 'abc',
        }).addTo(map);

        L.marker([la, lo]).addTo(map).bindPopup(popupLabel);

        const ro = new ResizeObserver(() => {
            map.invalidateSize();
        });
        ro.observe(el);
        requestAnimationFrame(() => map.invalidateSize());
        const t = window.setTimeout(() => map.invalidateSize(), 350);

        return () => {
            window.clearTimeout(t);
            ro.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, [coordsOk, lat, lng, popupLabel]);

    if (coordsOk) {
        return (
            <div
                ref={containerRef}
                className="hjd-map-canvas-wrap"
                role="application"
                aria-label="Carte — localisation enregistrée de l'entreprise"
            />
        );
    }

    const addr = typeof addressText === 'string' ? addressText.trim() : '';
    if (addr) {
        const q = encodeURIComponent(addr);
        return (
            <div className="hjd-map-iframe-wrap">
                <iframe
                    title="Carte — localisation entreprise"
                    className="hjd-map-iframe"
                    src={`https://maps.google.com/maps?q=${q}&t=&z=14&ie=UTF8&iwloc=B&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                    className="hjd-map-external"
                    href={`https://www.google.com/maps/search/?api=1&query=${q}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Ouvrir dans Google Maps
                </a>
            </div>
        );
    }

    return (
        <div className="hjd-map-fallback" role="status">
            <span className="material-symbols-outlined hjd-map-fallback-icon" aria-hidden>
                map
            </span>
            <p>
                Ajoutez l&apos;adresse du siège ou les coordonnées GPS (profil entreprise) pour afficher la carte.
            </p>
        </div>
    );
}
