import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

// Perbaikan icon default Leaflet agar tidak hilang/broken
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const API_BASE_URL = "https://geo-archive-3.emergent.host";

function MapResizerAndFitter({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    
    // Paksa Leaflet untuk menghitung ulang ukuran kontainer agar tidak blank/0px
    setTimeout(() => {
      map.invalidateSize();
      if (bounds) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, 200);
  }, [map, bounds]);

  return null;
}

export default function MapPreview({ mapId, certificateStatus, areaSize }) {
  const [geojson, setGeojson] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Jika mapId dari prop kosong, ambil langsung dari URL browser
    let targetMapId = mapId;
    if (!targetMapId && typeof window !== "undefined") {
      const pathSegments = window.location.pathname.split("/");
      targetMapId = pathSegments[pathSegments.length - 1];
    }

    if (!targetMapId || targetMapId === "map") {
      setLoading(false);
      setError("No Map ID provided");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const endpoint = API_BASE_URL + "/maps/" + targetMapId + "/geojson";
        const { data } = await axios.get(endpoint);

        if (typeof data === "string" && data.includes("<!doctype html>")) {
          throw new Error("Backend returned HTML response");
        }

        if (mounted) {
          setGeojson(data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          console.error("Fetch GeoJSON Error:", e);
          setError(
            e.response?.data?.detail || e.message || "Preview unavailable for this file"
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [mapId]);

  if (loading) {
    return (
      <div className="w-full h-[400px] min-h-[350px] flex items-center justify-center bg-gray-900 text-gray-300 text-sm rounded-lg">
        Loading map preview...
      </div>
    );
  }

  if (error || !geojson) {
    return (
      <div className="w-full h-[400px] min-h-[350px] flex items-center justify-center bg-gray-900 text-red-400 text-sm rounded-lg">
        {error || "Preview unavailable for this file"}
      </div>
    );
  }

  let bounds = null;
  try {
    const layer = L.geoJSON(geojson);
    const b = layer.getBounds();
    if (b.isValid()) bounds = b;
  } catch (e) {
    console.warn("Invalid bounds:", e);
  }

  const hasFeatures =
    geojson &&
    (geojson.type === "Feature" ||
      geojson.type === "FeatureCollection" ||
      (Array.isArray(geojson.features) && geojson.features.length > 0));

  return (
    <div className="w-full h-[400px] min-h-[350px] relative rounded-lg overflow-hidden border border-gray-700">
      <MapContainer
        center={[0, 0]}
        zoom={2}
        style={{ width: "100%", height: "100%", minHeight: "350px" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution="&copy; Google Maps"
          url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          subdomains={["mt0", "mt1", "mt2", "mt3"]}
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
                extraInfo += "<div><b>Status Sertifikat</b>: " + certificateStatus + "</div>";
              }
              if (areaSize) {
                extraInfo += "<div><b>Luas Wilayah</b>: " + areaSize + " m²</div>";
              }

              const rows = Object.entries(p)
      .filter(([k]) => k !== "certificate_status" && k !== "area_size")
      .slice(0, 8)
      .map(([k, v]) => "<div><b>" + k + "</b>: " + String(v).slice(0, 80) + "</div>")
      .join("");

    const content = [extraInfo, rows].filter(Boolean).join("<hr/>");

    layer.bindPopup(
      '<div style="font-family: sans-serif"><b>' + name + "</b><hr/>" + content + "</div>"
    );
            }}
          />
        )}

        <MapResizerAndFitter bounds={bounds} />
      </MapContainer>
    </div>
  );
}
