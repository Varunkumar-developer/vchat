const KLIPY_API_KEY = process.env.NEXT_PUBLIC_KLIPY_API_KEY;
const BASE_URL = "https://api.klipy.com/api/v1";

export function isKlipyConfigured() {
  return Boolean(KLIPY_API_KEY);
}

async function klipyFetch(path, params = {}, signal) {
  const url = new URL(`${BASE_URL}/${KLIPY_API_KEY}/gifs/${path}`);
  url.searchParams.set("per_page", "24");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("format_filter", "gif");

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`KLIPY request failed (${res.status})`);

  const json = await res.json();
  if (!json.result) throw new Error("KLIPY request failed");

  return json.data?.data || [];
}

export function fetchTrending(signal) {
  return klipyFetch("trending", {}, signal);
}

export function searchGifs(query, signal) {
  return klipyFetch("search", { q: query }, signal);
}

export function pickGifUrls(item) {
  return {
    id: item.id,
    title: item.title || item.slug || "",
    preview: item.file?.sm?.gif?.url,
    url:
      item.file?.md?.gif?.url ||
      item.file?.hd?.gif?.url ||
      item.file?.sm?.gif?.url,
  };
}
