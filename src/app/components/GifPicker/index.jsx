"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchTrending,
  searchGifs,
  pickGifUrls,
  isKlipyConfigured,
} from "@/lib/klipy";

export default function GifPicker({ onSelect }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isKlipyConfigured()) return;

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError("");

        const request = query.trim()
          ? searchGifs(query.trim(), controller.signal)
          : fetchTrending(controller.signal);

        request
          .then((data) => {
            setGifs((data || []).map(pickGifUrls).filter((g) => g.preview && g.url));
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              setError("Failed to load GIFs. Try again.");
              setGifs([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query ? 350 : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="absolute bottom-[calc(100%+12px)] right-0 z-20 w-[320px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-lg border border-solid border-gray-100 overflow-hidden animate-fadeIn">
      {/* Search */}
      <div className="p-[8px_12px] border-b border-solid border-gray-100">
        <input
          ref={inputRef}
          placeholder="Search KLIPY..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full block rounded-lg bg-gray-50 h-[34px] outline-none px-[12px] text-sm focus:bg-white focus:ring-1 focus:ring-gray-200 transition-colors"
        />
      </div>

      {/* Results */}
      <div className="p-[8px] h-[240px] overflow-y-auto [scrollbar-width:thin] relative">
        {!isKlipyConfigured() ? (
          <div className="h-full grid place-items-center text-center px-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Add <code className="bg-gray-100 px-1 py-[2px] rounded">NEXT_PUBLIC_KLIPY_API_KEY</code>{" "}
              to <code className="bg-gray-100 px-1 py-[2px] rounded">.env.local</code> to enable
              GIFs. Get a free key at klipy.com/developers
            </p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-[8px]" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[104px] rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="h-full grid place-items-center text-center px-4">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full grid place-items-center text-center px-4">
            <p className="text-xs text-gray-400">No GIFs found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[8px]">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                title={gif.title}
                onClick={() => onSelect(gif.url)}
                className="cursor-pointer group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.preview}
                  alt={gif.title || "GIF"}
                  loading="lazy"
                  className="w-full h-[104px] object-cover rounded-lg group-hover:opacity-80 transition-opacity"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-[12px] py-[4px] border-t border-solid border-gray-100 flex items-center justify-end">
        <span className="text-[10px] text-gray-300">Powered by KLIPY</span>
      </div>
    </div>
  );
}
