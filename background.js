"use strict";

browser.runtime.onMessage.addListener((msg, _sender) => {
  if (!msg || typeof msg !== "object") return;

  const Db = self.MangaDb;

  switch (msg.type) {
    case "SAVE_POSITION":
      return handleSave(msg.payload);
    case "QUERY_SERIES":
      return Db.queryBySeries(msg.series);
    case "GET_VOLUME":
      return Db.getVolume(msg.url);
    default:
      return;
  }
});

async function handleSave(p) {
  if (!p || !p.url) throw new Error("SAVE_POSITION missing url");
  const Db = self.MangaDb;
  const existing = await Db.getVolume(p.url);
  const now = p.timestamp || Date.now();
  const record = {
    url: p.url,
    series: p.series,
    seriesTitle: p.seriesTitle,
    volume: p.volume,
    page: p.page,
    totalPages: p.totalPages,
    scrollY: p.scrollY,
    firstVisitedAt: existing ? existing.firstVisitedAt : now,
    lastVisitedAt: now,
  };
  await Db.putVolume(record);
  return { ok: true };
}
