"use strict";

// Matches /{series}-(volume|chapitre|chapter)-{N}/
const SUSHI_ENTRY_RE =
  /^\/([a-z0-9]+(?:-[a-z0-9]+)*)-(volume|chapitre|chapter)-(\d+)\/?$/;

function slugToTitle(slug) {
  return slug
    .split("-")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function parseSushiUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.hostname !== "sushiscan.net") return null;
  const m = u.pathname.match(SUSHI_ENTRY_RE);
  if (!m) return null;
  const series = m[1];
  const type = m[2]; // "volume" | "chapitre" | "chapter"
  const number = parseInt(m[3], 10);
  if (!Number.isFinite(number)) return null;
  return {
    series,
    type,
    number,
    seriesTitle: slugToTitle(series),
    canonicalUrl: `${u.origin}${u.pathname.endsWith("/") ? u.pathname : u.pathname + "/"}`,
  };
}

if (typeof self !== "undefined") {
  self.parseSushiUrl = parseSushiUrl;
  self.slugToTitle = slugToTitle;
}
