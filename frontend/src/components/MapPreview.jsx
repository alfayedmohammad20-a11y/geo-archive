import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { http } from "@/lib/api";

// Fix Leaflet default icon paths (needed under bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function computeBounds(geojson) {
  const coords = [];
  const walk = (c) => {
    if (typeof c[0] === "number") coords.push(c);
    else c.forEach(walk);
  };
  (geojson.features || []).forEach((f) => {
    if (f.geometry && f.geometry.coordinates) walk(f.geometry.coordinates);
  });
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c[1]);
  const lngs = coords.map((c) => c[0]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

function FitBounds({ bounds, map }) {
  useEffect(() => {
    if (bounds && map) {
      try {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      } catch {}
    }
  }, [bounds, map]);
  return null;
}

export default function MapPreview({ mapId }) {
  const [geojson, setGeojson] = useState(null);
  const [error, setError] = useState(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await http.get(`/maps/${mapId}/geojson`);
        if (mounted) setGeojson(data);
      } catch (e) {
        if (mounted)
          setError(
            e.response?.data?.detail || "Preview unavailable for this file"
          );
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mapId]);

  const bounds = geojson ? computeBounds(geojson) : null;
  const hasFeatures = geojson && (geojson.features || []).length > 0;

  return (
    <div
      data-testid="map-preview"
      className="w-full h-[500px] lg:h-[70vh] bg-[#E5E5E5] border border-black/10 relative overflow-hidden"
    >
      {error && (
        <div
          data-testid="map-preview-error"
          className="absolute inset-0 flex items-center justify-center text-sm text-[#52525B] p-8 text-center font-mono"
        >
          {error}
        </div>
      )}
      {!error && !geojson && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono uppercase tracking-widest text-[#52525B]">
          Loading preview…
        </div>
      )}
      {geojson && (
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom
          whenCreated={setMap}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hasFeatures && (
            <GeoJSON
              data={geojson}
              style={{ color: "#002FA7", weight: 2, fillOpacity: 0.15 }}
              pointToLayer={(f, latlng) => L.marker(latlng)}
              onEachFeature={(f, layer) => {
                const p = f.properties || {};
                const name = p.name || p.NAME || "Feature";
                const rows = Object.entries(p)
                  .slice(0, 8)
                  .map(
                    ([k, v]) =>
                      `<div><b>${k}</b>: ${String(v).slice(0, 80)}</div>`
                  )
                  .join("");
                layer.bindPopup(`<div style="font-family:'IBM Plex Sans'"><b>${name}</b>${rows ? "<hr/>" + rows : ""}</div>`);
              }}
            />
          )}
          <FitBounds bounds={bounds} map={map} />
        </MapContainer>
      )}
    </div>
  );
}
