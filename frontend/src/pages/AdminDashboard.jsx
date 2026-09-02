import { useEffect, useState, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  UploadSimple,
  Trash,
  FilePlus,
  MapTrifold,
} from "@phosphor-icons/react";
import { toast, Toaster } from "sonner";
import { http, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const EXT_LABEL = { kml: "KML", kmz: "KMZ", zip: "SHP" };

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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [maps, setMaps] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await http.get("/maps");
    setMaps(Array.isArray(data) ? data : data?.maps || []);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (user === undefined)
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 font-mono text-xs">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/admin/login" replace />;

  const upload = async (e) => {
    e.preventDefault();
    if (!file || !name.trim()) {
      toast.error("Name and file are required");
      return;
    }
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["kml", "kmz", "zip"].includes(ext)) {
      toast.error("Only .kml, .kmz or .zip (shapefile) files are supported");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("description", description);
      fd.append("tags", tags);
      fd.append("file", file);
      const res = await fetch(`${API}/maps`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Upload failed (${res.status})`);
      }
      toast.success("Map uploaded");
      setName("");
      setDescription("");
      setTags("");
      setFile(null);
      document.getElementById("file-input").value = "";
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const del = async (id) => {
    if (!confirm("Delete this map?")) return;
    try {
      await http.delete(`/maps/${id}`);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12">
      <Toaster position="top-right" />
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#002FA7] mb-2">
        // Admin Console
      </div>
      <h1 className="font-display text-4xl lg:text-5xl mb-10">
        Manage archive
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload */}
        <form
          onSubmit={upload}
          data-testid="upload-form"
          className="lg:col-span-5 card-sharp p-8 h-fit"
        >
          <div className="flex items-center gap-2 mb-6">
            <FilePlus size={24} weight="duotone" color="#002FA7" />
            <h2 className="font-display text-2xl">New upload</h2>
          </div>

          <label className="block font-mono text-xs uppercase tracking-widest text-[#52525B] mb-2">
            Name
          </label>
          <input
            data-testid="upload-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border-2 border-black/10 px-4 py-3 mb-6 focus:border-[#002FA7] outline-none"
          />

          <label className="block font-mono text-xs uppercase tracking-widest text-[#52525B] mb-2">
            Description
          </label>
          <textarea
            data-testid="upload-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white border-2 border-black/10 px-4 py-3 mb-6 focus:border-[#002FA7] outline-none resize-none"
          />

          <label className="block font-mono text-xs uppercase tracking-widest text-[#52525B] mb-2">
            Tags <span className="text-[#A1A1AA] normal-case tracking-normal">(comma-separated, optional)</span>
          </label>
          <input
            data-testid="upload-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. europe, hydrology, protected-areas"
            className="w-full bg-white border-2 border-black/10 px-4 py-3 mb-6 focus:border-[#002FA7] outline-none"
          />

          <label className="block font-mono text-xs uppercase tracking-widest text-[#52525B] mb-2">
            File (.kml / .kmz / .zip shapefile)
          </label>
          <input
            id="file-input"
            data-testid="upload-file"
            type="file"
            accept=".kml,.kmz,.zip"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-white border-2 border-dashed border-black/20 px-4 py-6 mb-6 file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-[#0A0A0A] file:text-white file:font-mono file:text-xs file:uppercase file:cursor-pointer"
          />

          <button
            type="submit"
            data-testid="upload-submit"
            disabled={uploading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <UploadSimple size={18} weight="bold" />
            {uploading ? "Uploading…" : "Upload to archive"}
          </button>
        </form>

        {/* List */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-4">
            <h2 className="font-display text-2xl">
              Uploaded maps ({maps.length})
            </h2>
          </div>
          {maps.length === 0 && (
            <div className="border-2 border-dashed border-black/15 py-16 flex flex-col items-center text-center">
              <MapTrifold size={40} weight="duotone" color="#A1A1AA" />
              <p className="mt-3 font-mono text-xs uppercase tracking-widest text-[#52525B]">
                No maps yet
              </p>
            </div>
          )}
          <div className="space-y-3">
            {Array.isArray(maps) && maps.map((m) => (
              <div
                key={m.id}
                data-testid={`admin-row-${m.id}`}
                className="card-sharp p-5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-[#002FA7] text-[#002FA7]"
                    >
                      {EXT_LABEL[m.ext] || m.ext}
                    </span>
                    <span className="font-mono text-xs text-[#A1A1AA]">
                      {humanSize(m.size)}
                    </span>
                  </div>
                  <Link
                    to={`/map/${m.id}`}
                    className="font-display text-lg hover:text-[#002FA7] truncate block"
                  >
                    {m.name}
                  </Link>
                  <p className="text-xs text-[#52525B] truncate">
                    {m.description || "—"}
                  </p>
                </div>
                <button
                  data-testid={`delete-btn-${m.id}`}
                  onClick={() => del(m.id)}
                  className="p-2 hover:bg-[#FF3B30] hover:text-white border border-black/10 transition-colors"
                  title="Delete"
                >
                  <Trash size={18} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
