// src/images.js — fetch one photo per outfit from Unsplash using the AI's image_query.
// If no UNSPLASH_ACCESS_KEY is set (or the search fails), returns null and the
// frontend falls back to its color-swatch flat-lay — the app never breaks on images.

export async function findImage(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !query) return null;

  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "portrait");
    url.searchParams.set("content_filter", "high");

    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;

    return {
      url: photo.urls.small,
      alt: photo.alt_description || query,
      credit: photo.user?.name || "Unsplash",
      creditLink: photo.user?.links?.html || "https://unsplash.com",
    };
  } catch {
    return null;
  }
}

/** Attach an image (or null) to each outfit, in parallel. */
export async function attachImages(outfits) {
  return Promise.all(
    outfits.map(async (o) => ({ ...o, image: await findImage(o.image_query) }))
  );
}
