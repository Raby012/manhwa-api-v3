// src/components/BrowseClient.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { AnimeCard } from "@/components/AnimeCard";
import { Search, SlidersHorizontal, X, ChevronDown, Loader2 } from "lucide-react";

const GENRES = [
  "Action","Adventure","Comedy","Drama","Ecchi","Fantasy","Horror",
  "Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance",
  "Sci-Fi","Slice of Life","Sports","Supernatural","Thriller",
];
const FORMATS  = ["TV","Movie","OVA","ONA","Special","Music"];
const SEASONS  = ["Winter","Spring","Summer","Fall"];
const YEARS    = Array.from({ length: 30 }, (_, i) => String(2026 - i));
const SORTS    = [
  { label: "Trending",   value: "TRENDING_DESC"   },
  { label: "Popularity", value: "POPULARITY_DESC" },
  { label: "Score",      value: "SCORE_DESC"      },
  { label: "Newest",     value: "START_DATE_DESC"  },
  { label: "Title A–Z",  value: "TITLE_ROMAJI"    },
];
const STATUSES = ["RELEASING","FINISHED","NOT_YET_RELEASED","CANCELLED","HIATUS"];
const STATUS_LABELS: Record<string,string> = {
  RELEASING:"Releasing", FINISHED:"Finished",
  NOT_YET_RELEASED:"Not Yet Released", CANCELLED:"Cancelled", HIATUS:"Hiatus"
};

interface Anime {
  id: number;
  title: { english?: string; romaji: string };
  coverImage: { large: string; extraLarge: string; medium: string; color: string | null };
  format?: string;
  averageScore?: number;
  episodes?: number;
  status?: string;
}

export default function BrowseClient() {
  const [search,     setSearch]     = useState("");
  const [genres,     setGenres]     = useState<string[]>([]);
  const [format,     setFormat]     = useState("");
  const [season,     setSeason]     = useState("");
  const [year,       setYear]       = useState("");
  const [status,     setStatus]     = useState("");
  const [sort,       setSort]       = useState("TRENDING_DESC");
  const [showFilter, setShowFilter] = useState(false);
  const [animes,     setAnimes]     = useState<Anime[]>([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const activeFilters = genres.length + (format?1:0) + (season?1:0) + (year?1:0) + (status?1:0);

  const fetchAnimes = useCallback(async (reset: boolean, currentPage: number) => {
    setLoading(true);
    setFetchError(false);

    // Build query params for our server-side proxy
    const params = new URLSearchParams();
    params.set("page",    String(currentPage));
    params.set("perPage", "24");
    params.set("sort",    sort);
    if (search.trim())  params.set("search",  search.trim());
    if (genres.length)  params.set("genres",  genres.join(","));
    if (format)         params.set("format",  format);
    if (season)         params.set("season",  season);
    if (year)           params.set("year",    year);
    if (status)         params.set("status",  status);

    try {
      // Call our own API route — avoids AniList blocking client-side requests
      const res  = await fetch(`/api/browse?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const media    = (json.data?.Page?.media ?? []) as Anime[];
      const pageInfo = json.data?.Page?.pageInfo;

      setHasMore(pageInfo?.hasNextPage ?? false);
      if (reset) {
        setAnimes(media);
        setPage(2);
      } else {
        setAnimes((p) => {
          const ids = new Set(p.map((a) => a.id));
          return [...p, ...media.filter((a) => !ids.has(a.id))];
        });
        setPage((p) => p + 1);
      }
    } catch (e) {
      console.error("Browse fetch error:", e);
      setFetchError(true);
    }
    setLoading(false);
  }, [search, genres, format, season, year, status, sort]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchAnimes(true, 1);
    }, search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [search, genres, format, season, year, status, sort, fetchAnimes]);

  function toggleGenre(g: string) {
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  function clearFilters() {
    setGenres([]); setFormat(""); setSeason(""); setYear(""); setStatus(""); setSort("TRENDING_DESC");
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl text-white mb-5">BROWSE ANIME</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" placeholder="Search anime..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-1 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand transition-colors" />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="appearance-none bg-surface-1 border border-white/8 rounded-xl pl-3 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-brand cursor-pointer">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <button onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                showFilter || activeFilters > 0
                  ? "bg-brand text-white border-brand"
                  : "bg-surface-1 text-gray-300 border-white/8 hover:border-brand/50"
              }`}>
              <SlidersHorizontal size={15} />
              Filters
              {activeFilters > 0 && (
                <span className="bg-white/20 text-white text-xs rounded-full px-1.5 py-0.5">{activeFilters}</span>
              )}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="bg-surface-1 border border-white/8 rounded-2xl p-4 mb-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Filters</span>
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="text-xs text-brand flex items-center gap-1 hover:opacity-80">
                  <X size={11} /> Clear all
                </button>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {GENRES.map((g) => (
                  <button key={g} onClick={() => toggleGenre(g)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                      genres.includes(g)
                        ? "bg-brand text-white border-brand"
                        : "bg-surface-2 text-gray-400 border-white/8 hover:border-brand/40 hover:text-white"
                    }`}>{g}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "FORMAT", value: format, setter: setFormat, options: FORMATS, labels: null },
                { label: "SEASON", value: season, setter: setSeason, options: SEASONS, labels: null },
                { label: "YEAR",   value: year,   setter: setYear,   options: YEARS,   labels: null },
                { label: "STATUS", value: status, setter: setStatus, options: STATUSES, labels: STATUS_LABELS },
              ].map(({ label, value, setter, options, labels }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">{label}</p>
                  <div className="relative">
                    <select value={value} onChange={(e) => setter(e.target.value)}
                      className="w-full appearance-none bg-surface-2 border border-white/8 rounded-lg pl-3 pr-7 py-2 text-sm text-white focus:outline-none focus:border-brand">
                      <option value="">Any</option>
                      {options.map((o) => (
                        <option key={o} value={o}>{labels ? labels[o] : o}</option>
                      ))}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {genres.map((g) => (
              <button key={g} onClick={() => toggleGenre(g)}
                className="flex items-center gap-1 bg-brand/15 text-brand border border-brand/25 rounded-full px-2.5 py-0.5 text-xs font-medium hover:bg-brand/25 transition-colors">
                {g} <X size={9} />
              </button>
            ))}
          </div>
        )}

        {fetchError && (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">Failed to load anime.</p>
            <button onClick={() => fetchAnimes(true, 1)}
              className="bg-brand text-white px-5 py-2 rounded-xl text-sm font-medium">
              Try Again
            </button>
          </div>
        )}

        {!loading && !fetchError && animes.length > 0 && (
          <p className="text-xs text-gray-600 mb-3">{animes.length} results</p>
        )}

        {!fetchError && (
          <>
            {animes.length === 0 && !loading ? (
              <div className="text-center py-24 text-gray-600">
                <Search size={36} className="mx-auto mb-3 opacity-30" />
                <p>No anime found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                  {animes.map((anime) => (
                    <AnimeCard key={anime.id} anime={anime as any} size="sm" />
                  ))}
                  {loading && animes.length === 0 && Array.from({length:24}).map((_,i) => (
                    <div key={i} className="aspect-[2/3] bg-surface-1 rounded-xl animate-pulse" />
                  ))}
                </div>
                {loading && animes.length > 0 && (
                  <div className="flex justify-center mt-8">
                    <Loader2 size={24} className="animate-spin text-brand" />
                  </div>
                )}
                {hasMore && !loading && (
                  <div className="flex justify-center mt-8">
                    <button onClick={() => fetchAnimes(false, page)}
                      className="flex items-center gap-2 bg-surface-1 hover:bg-surface-2 border border-white/8 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all">
                      Load More
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
