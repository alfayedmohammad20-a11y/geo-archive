import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass, MapTrifold, ArrowRight, Stack } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { http } from "@/lib/api";

const EXT_LABEL = {
  kml: "KML",
  kmz: "KMZ",
  zip: "SHP",
};

const EXT_COLOR = {
  kml: "#002FA7",
  kmz: "#00227A",
  zip: "#FF3B30",
};

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

function MapCard({ m, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.4 }}
    >
      <Link
        to={`/map/${m.id}`}
        data-testid={`map-card-${m.id}`}
        className="card-sharp block p-6 h-full"
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 border"
            style={{ color: EXT_COLOR[m.ext], borderColor: EXT_COLOR[m.ext] }}
          >
            {EXT_LABEL[m.ext] || m.ext}
          </div>
          <span className="font-mono text-xs text-[#A1A1AA]">
            {humanSize(m.size)}
          </span>
        </div>
        <h3 className="font-display text-2xl leading-none mb-3 text-[#0A0A0A]">
          {m.name}
        </h3>
        <p className="text-sm text-[#52525B] leading-relaxed line-clamp-3 min-h-[3.5rem]">
          {m.description || "No description provided."}
        </p>
        {m.tags && m.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            Array.isArray(m.tags && m.tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[#F4F4F5] border border-black/10 text-[#52525B]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-6 flex items-center gap-2 text-[#002FA7] font-mono text-xs uppercase tracking-widest">
          View & Download <ArrowRight size={14} weight="bold" />
        </div>
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const [q, setQ] = useState("");
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState([]);
  const [activeTags, setActiveTags] = useState([]);

  const load = useCallback(async (search = "", tags = []) => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (tags.length) params.tags = tags.join(",");
      const { data } = await http.get("/maps", { params });
      setMaps(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const { data } = await http.get("/tags");
      setAllTags(data);
    } catch (err) {
      console.warn("failed to load tags", err);
    }
  }, []);

  useEffect(() => {
    load("", []);
    loadTags();
  }, [load, loadTags]);

  useEffect(() => {
    load(q, activeTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTags]);

  const submit = (e) => {
    e.preventDefault();
    load(q, activeTags);
  };

  const toggleTag = (t) => {
    setActiveTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-black/10">
        <div className="absolute inset-0 topo-bg opacity-25" />
        <div className="absolute inset-0 grain" />
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-20 lg:py-32">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#002FA7] mb-6">
            // Public Geospatial Archive · v1.0
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl leading-[0.95] mb-8 max-w-5xl">
            The open registry of{" "}
            <span className="text-[#002FA7]">shapefiles</span> &amp; kml layers.
          </h1>
          <p className="text-lg text-[#52525B] max-w-2xl mb-12 leading-relaxed">
            Browse, preview, and download geospatial datasets. Every entry
            opens directly in Google Earth Pro with one click.
          </p>

          <form
            onSubmit={submit}
            data-testid="search-form"
            className="flex items-center bg-white border-2 border-black max-w-2xl"
          >
            <MagnifyingGlass
              size={20}
              weight="bold"
              className="ml-4 text-[#0A0A0A]"
            />
            <input
              data-testid="search-input"
              type="text"
              placeholder="Search by name, description or tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 bg-transparent px-4 py-4 outline-none text-base"
            />
            <button
              type="submit"
              data-testid="search-submit"
              className="bg-[#002FA7] text-white px-6 py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#00227A] transition-colors"
            >
              Search
            </button>
          </form>

          {allTags.length > 0 && (
            <div
              data-testid="tag-filter-bar"
              className="mt-6 flex flex-wrap gap-2 max-w-3xl"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#52525B] self-center mr-1">
                Filter:
              </span>
              Array.isArray(allTags) && allTags.map((t) => {
                const on = activeTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    data-testid={`tag-chip-${t}`}
                    onClick={() => toggleTag(t)}
                    className={`font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                      on
                        ? "bg-[#002FA7] text-white border-[#002FA7]"
                        : "bg-transparent text-[#0A0A0A] border-black/20 hover:border-black"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
              {activeTags.length > 0 && (
                <button
                  type="button"
                  data-testid="tag-clear"
                  onClick={() => setActiveTags([])}
                  className="font-mono text-[11px] uppercase tracking-widest px-3 py-1.5 text-[#FF3B30] hover:underline"
                >
                  Clear ×
                </button>
              )}
            </div>
          )}

          <div className="mt-16 grid grid-cols-3 max-w-lg gap-8 border-t border-black/10 pt-8">
            <div>
              <div className="font-display text-3xl">{maps.length}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#52525B] mt-1">
                Entries
              </div>
            </div>
            <div>
              <div className="font-display text-3xl">3</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#52525B] mt-1">
                Formats
              </div>
            </div>
            <div>
              <div className="font-display text-3xl">∞</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#52525B] mt-1">
                Downloads
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Archive Grid */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 py-16 lg:py-24">
        <div className="flex items-end justify-between mb-10 border-b border-black/10 pb-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#002FA7] mb-2 flex items-center gap-2">
              <Stack size={14} weight="bold" /> Archive Index
            </div>
            <h2 className="font-display text-3xl lg:text-5xl">
              {q ? `Results for "${q}"` : "Latest uploads"}
            </h2>
          </div>
          <div className="font-mono text-xs text-[#52525B]">
            {loading ? "loading…" : `${maps.length} record(s)`}
          </div>
        </div>

        {!loading && maps.length === 0 && (
          <div
            data-testid="empty-state"
            className="border-2 border-dashed border-black/15 py-24 flex flex-col items-center justify-center text-center"
          >
            <MapTrifold size={48} weight="duotone" color="#A1A1AA" />
            <p className="mt-4 font-display text-xl text-[#0A0A0A]">
              Nothing here yet
            </p>
            <p className="text-sm text-[#52525B] mt-2">
              Sign in as admin to upload the first shapefile or KML.
            </p>
          </div>
        )}

        <div
          data-testid="maps-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {Array.isArray(maps) && maps.map((m, i) => (
            <MapCard key={m.id} m={m} i={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
