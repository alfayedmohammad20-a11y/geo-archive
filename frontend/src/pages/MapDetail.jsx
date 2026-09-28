import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { http, fileUrl } from "../lib/api";

export default function MapDetail() {
  const { id } = useParams();
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    http
      .get(`/maps/${id}`)
      .then((res) => {
        setMapData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load map detail:", err);
        setError("Gagal memuat detail peta.");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div style={{ padding: "32px", textAlign: "center" }}>Memuat data peta...</div>;
  }

  if (error || !mapData) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "red" }}>
        {error || "Peta tidak ditemukan."}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <Link to="/" style={{ display: "inline-block", marginBottom: "16px" }}>
        &larr; Kembali ke Dashboard
      </Link>

      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
        {mapData.title || mapData.name || "Detail Peta"}
      </h1>
      <p style={{ color: "#666", marginBottom: "16px" }}>
        {mapData.description || "Tidak ada deskripsi."}
      </p>

      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        <a
          href={fileUrl(mapData.id, "kml")}
          style={{
            padding: "10px 16px",
            backgroundColor: "#2563eb",
            color: "#fff",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Buka di Google Earth Pro (.KML)
        </a>

        <a
          href={fileUrl(mapData.id, "geojson")}
          style={{
            padding: "10px 16px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            textDecoration: "none",
            color: "#333",
          }}
        >
          Download GeoJSON
        </a>
      </div>
    </div>
  );
}
