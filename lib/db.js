"use strict";

(() => {
  const DB_NAME = "manga-tracker";
  const DB_VERSION = 1;
  const STORE = "volumes";

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, {
            keyPath: "url",
          });
          store.createIndex("by_series", "series", { unique: false });
          store.createIndex("by_lastVisitedAt", "lastVisitedAt", {
            unique: false,
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB open blocked"));
    });
    return dbPromise;
  }

  function tx(mode) {
    return openDb().then((db) =>
      db.transaction(STORE, mode).objectStore(STORE),
    );
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getVolume(url) {
    const store = await tx("readonly");
    return reqToPromise(store.get(url));
  }

  async function putVolume(record) {
    const store = await tx("readwrite");
    return reqToPromise(store.put(record));
  }

  async function queryBySeries(series) {
    const store = await tx("readonly");
    const idx = store.index("by_series");
    return reqToPromise(idx.getAll(IDBKeyRange.only(series)));
  }

  async function deleteVolume(url) {
    const store = await tx("readwrite");
    return reqToPromise(store.delete(url));
  }

  async function trimSeries(series, max) {
    const all = await queryBySeries(series);
    if (all.length <= max) return;
    all.sort((a, b) => (a.lastVisitedAt || 0) - (b.lastVisitedAt || 0));
    const toDelete = all.slice(0, all.length - max);
    for (const rec of toDelete) {
      await deleteVolume(rec.url);
    }
  }

  self.MangaDb = {
    openDb,
    getVolume,
    putVolume,
    queryBySeries,
    deleteVolume,
    trimSeries,
  };
})();
