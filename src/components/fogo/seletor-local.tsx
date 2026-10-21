'use client';

// Mini mapa do formulário: clique ou arraste o marcador para definir as coordenadas GPS.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { CIDADE } from '@/lib/catalog';

const pino = L.divIcon({
  html: '<div class="fogo-marcador" style="--cor:var(--primary);width:28px;height:28px;font-size:14px">📍</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function Cliques({ aoMudar }: { aoMudar: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => aoMudar(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recentrar({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().contains([lat, lng])) map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function SeletorLocal({ lat, lng, aoMudar }: { lat: number | null; lng: number | null; aoMudar: (lat: number, lng: number) => void }) {
  const temPonto = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  return (
    <MapContainer center={temPonto ? [lat!, lng!] : CIDADE.centro} zoom={14} className="h-64 w-full rounded-lg border">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" className="fogo-tiles" attribution="&copy; OpenStreetMap" />
      <Cliques aoMudar={aoMudar} />
      {temPonto && (
        <>
          <Recentrar lat={lat!} lng={lng!} />
          <Marker
            position={[lat!, lng!]}
            icon={pino}
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); aoMudar(p.lat, p.lng); } }}
          />
        </>
      )}
    </MapContainer>
  );
}
