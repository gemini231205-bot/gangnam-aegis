import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, MapPin, Navigation } from 'lucide-react';
import {
  PATROL_STATIONS,
  findNearestStations,
  locationToCoords,
  type PatrolStation,
  type NearestStationResult,
} from './gis';

interface GangnamMapProps {
  location: string;
  latitude: number;
  longitude: number;
  dispatched: boolean;
  selectedStationId: string;
  onStationSelect: (id: string) => void;
}

const DEFAULT_COORDS = { lat: 37.5012, lng: 127.0396 };

function createRedMarker(): L.DivIcon {
  return L.divIcon({
    className: 'custom-red-marker',
    html: `<div style="position:relative;width:32px;height:32px;">
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:28px;height:28px;border-radius:50% 50% 50% 0;background:#ef4444;border:2px solid #fca5a5;box-shadow:0 0 12px rgba(239,68,68,0.6);transform:rotate(-45deg);"></div>
      <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:14px;">🚨</div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function createStationMarker(active: boolean): L.DivIcon {
  const bg = active ? '#3b82f6' : '#64748b';
  const border = active ? '#93c5fd' : '#94a3b8';
  const glow = active ? 'box-shadow:0 0 10px rgba(59,130,246,0.5);' : '';
  return L.divIcon({
    className: 'custom-station-marker',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${bg};border:2px solid ${border};${glow}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function createCarMarker(): L.DivIcon {
  return L.divIcon({
    className: 'custom-car-marker',
    html: `<div style="width:32px;height:32px;border-radius:8px;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(59,130,246,0.4);">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.5-1.2-.7-1.9-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.6C1.9 11.3 1.5 12 1.5 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export default function GangnamMap({
  location,
  latitude,
  longitude,
  dispatched,
  selectedStationId,
  onStationSelect,
}: GangnamMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reportMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const stationMarkersRef = useRef<L.Marker[]>([]);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const [nearest3, setNearest3] = useState<NearestStationResult[]>([]);
  const [eta, setEta] = useState(3);
  const [distanceKm, setDistanceKm] = useState(0);
  const [selectedStation, setSelectedStation] = useState<PatrolStation>(PATROL_STATIONS[0]);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Determine reporter coordinates — prefer actual GPS, fallback to location string
  const locationCoords = locationToCoords(location);
  const reportCoords =
    latitude !== 0 && longitude !== 0
      ? { lat: latitude, lng: longitude }
      : locationCoords.lat !== 0
        ? { lat: locationCoords.lat, lng: locationCoords.lng }
        : DEFAULT_COORDS;

  // Parse GPS accuracy from location string (e.g. "±15m")
  useEffect(() => {
    const accMatch = location.match(/±(\d+)m/);
    if (accMatch) {
      setGpsAccuracy(parseInt(accMatch[1], 10));
    } else {
      setGpsAccuracy(null);
    }
  }, [location]);

  // Compute nearest 3 stations when coordinates change
  useEffect(() => {
    const results = findNearestStations(reportCoords.lat, reportCoords.lng, 3);
    setNearest3(results);
    if (results.length > 0) {
      setEta(results[0].etaMinutes);
      setDistanceKm(results[0].distanceKm);
      setSelectedStation(results[0].station);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, location]);

  // Initialize Leaflet map once — robust against StrictMode double-mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If a map already exists on this container, remove it first
    if (mapRef.current) {
      try { mapRef.current.remove(); } catch { /* already removed */ }
      mapRef.current = null;
      reportMarkerRef.current = null;
      accuracyCircleRef.current = null;
      stationMarkersRef.current = [];
      carMarkerRef.current = null;
    }

    // Clear any stale Leaflet state on the container element
    // @ts-expect-error: _leaflet_id is internal Leaflet property
    if (el._leaflet_id != null) {
      // @ts-expect-error: _leaflet_id is internal Leaflet property
      delete el._leaflet_id;
    }

    let map: L.Map;
    try {
      map = L.map(el, {
        center: [reportCoords.lat, reportCoords.lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      });
    } catch {
      // Container already initialized — force a clean slate
      el.innerHTML = '';
      // @ts-expect-error: _leaflet_id is internal Leaflet property
      delete el._leaflet_id;
      map = L.map(el, {
        center: [reportCoords.lat, reportCoords.lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      });
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'map-tiles-dark',
    }).addTo(map);

    mapRef.current = map;

    // Fix rendering after mount
    const sizeTimer = setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(sizeTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        reportMarkerRef.current = null;
        accuracyCircleRef.current = null;
        stationMarkersRef.current = [];
        carMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when coordinates or stations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers safely
    if (reportMarkerRef.current) {
      try { map.removeLayer(reportMarkerRef.current); } catch { /* already removed */ }
      reportMarkerRef.current = null;
    }
    stationMarkersRef.current.forEach((m) => {
      try { map.removeLayer(m); } catch { /* already removed */ }
    });
    stationMarkersRef.current = [];
    if (carMarkerRef.current) {
      try { map.removeLayer(carMarkerRef.current); } catch { /* already removed */ }
      carMarkerRef.current = null;
    }

    // Reporter marker
    const reportMarker = L.marker([reportCoords.lat, reportCoords.lng], { icon: createRedMarker() })
      .addTo(map)
      .bindPopup(`<b>🚨 보이스피싱 발생 지점</b><br/>${location}${gpsAccuracy ? `<br/>GPS 정확도: ±${gpsAccuracy}m` : ''}`);
    reportMarkerRef.current = reportMarker;

    // GPS accuracy circle
    if (accuracyCircleRef.current) {
      try { map.removeLayer(accuracyCircleRef.current); } catch { /* noop */ }
      accuracyCircleRef.current = null;
    }
    if (gpsAccuracy && gpsAccuracy > 0) {
      const circle = L.circle([reportCoords.lat, reportCoords.lng], {
        radius: gpsAccuracy,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '4 4',
      }).addTo(map);
      accuracyCircleRef.current = circle;
    }

    // Station markers (nearest 3)
    const stations = nearest3.length > 0 ? nearest3 : findNearestStations(reportCoords.lat, reportCoords.lng, 3);
    stations.forEach((result) => {
      const isActive = result.station.id === selectedStationId;
      const marker = L.marker([result.station.lat, result.station.lng], { icon: createStationMarker(isActive) })
        .addTo(map)
        .bindPopup(`<b>${result.station.name}</b><br/>거리: ${result.distanceKm.toFixed(1)}km · ETA: ${result.etaMinutes}분`);
      stationMarkersRef.current.push(marker);
    });

    // Car marker at selected station
    const station = stations.find((s) => s.station.id === selectedStationId)?.station ?? stations[0]?.station;
    if (station) {
      const carMarker = L.marker([station.lat, station.lng], { icon: createCarMarker() })
        .addTo(map);
      carMarkerRef.current = carMarker;
    }

    // Pan to reporter with tighter zoom for GPS-located reports
    const zoomLevel = latitude !== 0 && longitude !== 0 ? 16 : 14;
    map.setView([reportCoords.lat, reportCoords.lng], zoomLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, location, nearest3, selectedStationId, gpsAccuracy]);

  // Animate car to reporter when dispatched
  useEffect(() => {
    const map = mapRef.current;
    const car = carMarkerRef.current;
    if (!map || !car) return;

    if (!dispatched) return;

    const station = nearest3.find((s) => s.station.id === selectedStationId)?.station ?? nearest3[0]?.station;
    if (!station) return;

    const startLat = station.lat;
    const startLng = station.lng;
    const endLat = reportCoords.lat;
    const endLng = reportCoords.lng;
    const startTime = performance.now();
    const duration = 3000;
    let raf = 0;

    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      const lat = startLat + (endLat - startLat) * eased;
      const lng = startLng + (endLng - startLng) * eased;
      try { car.setLatLng([lat, lng]); } catch { /* map removed */ }
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatched, selectedStationId]);

  const handleStationRadioSelect = (stationId: string) => {
    onStationSelect(stationId);
    const result = nearest3.find((s) => s.station.id === stationId);
    if (result) {
      setEta(result.etaMinutes);
      setDistanceKm(result.distanceKm);
      setSelectedStation(result.station);
    }
  };

  return (
    <div className="space-y-3">
      {/* Leaflet map container */}
      <div
        ref={containerRef}
        className="relative rounded-xl border border-white/8 overflow-hidden h-64 sm:h-72 bg-black/40"
        style={{ zIndex: 0 }}
      />

      {/* Station selection UI */}
      <div className="rounded-xl border border-white/8 bg-black/30 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin className="w-3.5 h-3.5 text-blue-300" />
          <p className="text-[11px] font-bold text-slate-200">최우선 출동 파출소 3곳 (거리순)</p>
        </div>
        <div className="space-y-1.5">
          {nearest3.map((result, idx) => {
            const isSelected = result.station.id === selectedStationId;
            return (
              <label
                key={result.station.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-500/15 border-blue-400/30'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                }`}
              >
                <input
                  type="radio"
                  name="station-select"
                  checked={isSelected}
                  onChange={() => handleStationRadioSelect(result.station.id)}
                  className="w-3.5 h-3.5 accent-blue-400 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-500">#{idx + 1}</span>
                    <span className="text-xs font-semibold text-slate-200">{result.station.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-cyan-300">{result.distanceKm.toFixed(1)}km</span>
                    <span className="text-[10px] font-mono text-amber-300">ETA {result.etaMinutes}분</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* GPS accuracy badge */}
      {gpsAccuracy != null && (
        <div className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/20 px-3 py-1.5">
          <Navigation className="w-3 h-3 text-cyan-300" />
          <span className="text-[10px] font-mono text-cyan-300">
            GPS 정확도 ±{gpsAccuracy}m {gpsAccuracy <= 20 ? '(고정밀)' : gpsAccuracy <= 50 ? '(양호)' : '(보통)'}
          </span>
        </div>
      )}

      {/* ETA badge */}
      <div className="flex items-center justify-between rounded-lg glass-strong px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-cyan-300" />
          <span className="text-[11px] font-mono text-slate-300">
            {dispatched ? `이동 중 · ETA ${eta}분` : `ETA ${eta}분 (${distanceKm.toFixed(1)}km)`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Car className="w-3.5 h-3.5 text-blue-300" />
          <span className="text-[11px] font-mono text-blue-300">
            {selectedStation.name}
          </span>
        </div>
      </div>
    </div>
  );
}
