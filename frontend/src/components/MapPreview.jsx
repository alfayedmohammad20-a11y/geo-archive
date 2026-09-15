import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""; 

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (map && bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds]);
  return null;
}

export default function MapPreview({ mapId, certificateStatus, areaSize }) {
  const [geojson, setGeojson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const endpoint = API_BASE_URL
          ? `${API_BASE_URL}/maps/${mapId}/geojson`
          : `/maps/${mapId}/geojson`;

        const { data } = await axios.get(endpoint);
        
        if (typeof data === "string" && data.includes("<!doctype html>")) {
          throw new Error("Backend URL returned HTML instead of GeoJSON");
        }

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
      >
        <TileLayer
          attribution='&copy; Google Maps"
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          maxZoom={20}
        />
        {hasFeatures && (
          <GeoJSON
            key={JSON.stringify(geojson)}
            data={geojson}
            style={{
              color: "#ff2d55",
              weight: 3,
              opacity: 0.9,
              fillColor: "#ff2d55",
              fillOpacity: 0.35,
            }}
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
                `<div style="font-family: sans-serif"><b>${name}</b><hr/>${content}</div>'
              );
            }}
          />
        )}
        <FitBounds bounds={bounds} />
      </MapContainer>
    </div>
  );
}
