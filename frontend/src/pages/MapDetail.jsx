import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, GlobeStand, FileArchive } from "@phosphor-icons/react";
import { http, fileUrl } from "@/lib/api";
import MapPreview from "@/components/MapPreview";

const EXT_LABEL = { kml: "KML", kmz: "KMZ", zip: "SHAPEFILE (SHP)" };

function humanSize(n) {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
}

export default function MapDetail() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await http.get(`/maps/${id}`);
        setM(data);
      } catch (err) {
        console.warn("Failed to load map:", err);
        setNotFound(true);
      }
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-4xl mb-4">Map not found</h1>
        <Link to="/" className="btn-outline inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Archive
        </Link>
      </div>
    );
  }

  if (!m) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 font-mono text-xs uppercase tracking-widest text-[#52525B]">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12">
      <Link
        to="/"
        data-testid="back-link"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#52525B] hover:text-[#002FA7] mb-8"
      >
        <ArrowLeft size={14} weight="bold" /> Back to Archive
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#002FA7] mb-3">
            {EXT_LABEL[m.ext] || m.ext}
          </div>
          <h1 data-testid="map-title" className="font-display text-4xl lg:text-6xl leading-none mb-6">
            {m.name}
          </h1>
          <p className="text-base text-[#52525B] leading-relaxed mb-6 max-w-2xl">
            {m.description || "No description provided."}
          </p>
          {m.tags && m.tags.length > 0 && (
            <div
              data-testid="detail-tags"
              className="flex flex-wrap gap-2 mb-10"
            >
              {m.tags.map((t) => (
                <span
                  key={t}
                  className="font-mono text-[11px] uppercase tracking-widest px-3 py-1 border border-black/15 bg-white text-[#0A0A0A]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <MapPreview mapId={m.id} />
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <div className="card-sharp p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#002FA7] mb-4">
              // Metadata
            </div>
            <dl className="space-y-3 font-mono text-sm">
              <div className="flex justify-between border-b border-black/10 pb-2">
                <dt className="text-[#52525B]">Format</dt>
                <dd className="text-[#0A0A0A] font-medium">
                  {EXT_LABEL[m.ext]}
                </dd>
              </div>
              <div className="flex justify-between border-b border-black/10 pb-2">
                <dt className="text-[#52525B]">Size</dt>
                <dd className="text-[#0A0A0A] font-medium">
                  {humanSize(m.size)}
                </dd>
              </div>
              <div className="flex justify-between border-b border-black/10 pb-2">
                <dt className="text-[#52525B]">Filename</dt>
                <dd className="text-[#0A0A0A] font-medium truncate max-w-[180px]">
                  {m.original_filename}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#52525B]">Added</dt>
                <dd className="text-[#0A0A0A] font-medium">
                  {new Date(m.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          <a
            data-testid="download-original-btn"
            href={fileUrl(m.id, "download")}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Download size={18} weight="bold" />
            Download {EXT_LABEL[m.ext]}
          </a>
          <a
            data-testid="download-kml-btn"
            href={fileUrl(m.id, "kml")}
            className="btn-outline w-full flex items-center justify-center gap-2"
          >
            <GlobeStand size={18} weight="bold" />
            Open in Google Earth Pro
          </a>
          <a
            data-testid="download-geojson-btn"
            href={fileUrl(m.id, "geojson")}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-black/15 hover:bg-black hover:text-white transition-colors text-sm font-mono uppercase tracking-widest"
          >
            <FileArchive size={16} weight="bold" />
            GeoJSON
          </a>

          <div className="p-5 bg-[#0A0A0A] text-white">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FF3B30] mb-2">
              // Tip
            </div>
            <p className="text-sm text-white/80 leading-relaxed">
              Downloaded .kml file? Double-click it and it will open directly in
              Google Earth Pro on your machine.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
