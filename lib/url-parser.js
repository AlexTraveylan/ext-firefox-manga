"use strict";

const SUSHI_VOLUME_RE = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)-volume-(\d+)\/?$/;

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
  const m = u.pathname.match(SUSHI_VOLUME_RE);
  if (!m) return null;
  const series = m[1];
  const volume = parseInt(m[2], 10);
  if (!Number.isFinite(volume)) return null;
  return {
    series,
    volume,
    seriesTitle: slugToTitle(series),
    canonicalUrl: `${u.origin}${u.pathname.endsWith("/") ? u.pathname : u.pathname + "/"}`,
  };
}

if (typeof self !== "undefined") {
  self.parseSushiUrl = parseSushiUrl;
  self.slugToTitle = slugToTitle;
}
