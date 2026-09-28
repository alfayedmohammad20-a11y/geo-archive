import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { http, fileUrl } from "../lib/api";
import { Download, ArrowLeft, GlobeStand, FileArchive } from "lucide-react";

export default function MapDetail() {
  const { id } = useParams();
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    http.get(`/maps/${id}`)
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

  if (loading) return <div className="p-8 text-center">Memuat data peta...</div>;
  if (error || !mapData) return <div className="p-8 text-center text-red-500">{error || "Peta tidak ditemukan."}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium hover:underline mb-4">
        <ArrowLeft size={16} /> Kembali ke Dashboard
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel Kiri: Informasi Peta */}
        <div className="lg:col-span-2 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">{mapData.title}</h1>
          <p className="text-gray-600">{mapData.description || "Tidak ada deskripsi."}</p>

          <div className="bg-gray-50 border p-4 rounded-lg space-y-2 text-sm">
            <div><span className="font-semibold">Sertifikat:</span> {mapData.certificate_status || "-"}</div>
            <div><span className="font-semibold">Luas Wilayah:</span> {mapData.area_size ? `${mapData.area_size} m²` : "-"}</div>
          </div>

          {/* Tombol Akses & Download */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <a
              href={fileUrl(mapData.id, "download")}
              className="btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              <Download size={18} /> Unduh File Asli
            </a>
            
            <a
              href={fileUrl(mapData.id, "kml")}
              className="btn-outline flex items-center justify-center gap-2 px-4 py-2 rounded border border-gray-300 font-medium hover:bg-gray-100"
            >
              <GlobeStand size={18} /> Buka di Google Earth Pro (.KML)
            </a>

            <a
              href={fileUrl(mapData.id, "geojson")}
              className="btn-outline flex items-center justify-center gap-2 px-4 py-2 rounded border border-gray-300 font-medium hover:bg-gray-100"
            >
              <FileArchive size={18} /> Export GeoJSON
            </a>
          </div>
        </div>

        {/* Panel Kanan: Tips Google Earth */}
        <div className="bg-slate-900 text-white p-5 rounded-lg h-fit space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-orange-400">Petunjuk Google Earth Pro</div>
          <p className="text-sm text-gray-300 leading-relaxed">
            Klik tombol <strong>Buka di Google Earth Pro (.KML)</strong> untuk mengunduh berkas spasial. Setelah terunduh, klik ganda (*double-click*) file tersebut untuk membukanya secara otomatis di aplikasi Google Earth Pro komputer Anda.
          </p>
        </div>
      </div>
    </div>
  );
}
