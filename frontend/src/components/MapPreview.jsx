import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import http from "../lib/http";

function FitBounds({ bounds, map }) {
  useEffect(() => {
    if (map && bounds) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, bounds]);
  return null;
}

export default function MapPreview({ mapId, certificateStatus, areaSize }) {
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
        if (mounted) {
          setError(
            e.response?.data?.detail || "Preview unavailable for this file"
          );
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mapId]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (!geojson) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading map preview...
      </div>
    );
  }

  let bounds = null;
  try {
    const layer = L.geoJSON(geojson);
    const b = layer.getBounds();
    if (b.isValid()) bounds = b;
  } catch (e) {
    // ignore
  }

  const hasFeatures =
    geojson &&
    geojson.features &&
    Array.isArray(geojson.features) &&
    geojson.features.length > 0;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[0, 0]}
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

              let extraInfo = "";
              if (certificateStatus) {
                extraInfo += `<div><b>Status Sertifikat</b>: ${certificateStatus}</div>`;
              }
              if (areaSize) {
                extraInfo += `<div><b>Luas Wilayah</b>: ${areaSize} m²</div>`;
              }

              const rows = Object.entries(p)
                .filter(
                  ([k]) => k !== "certificate_status" && k !== "area_size"
                )
                .slice(0, 8)
                .map(
                  ([k, v]) =>
                    `<div><b>${k}</b>: ${String(v).slice(0, 80)}</div>`
                )
                .join("");

              const content = [extraInfo, rows].filter(Boolean).join("<hr/>");

              layer.bindPopup(
                `<div style="font-family:'IBM Plex Sans'"><b>${name}</b><hr/>${content}</div>`
              );
            }}
          />
        )}
        <FitBounds bounds={bounds} map={map} />
      </MapContainer>
    </div>
  );
}
