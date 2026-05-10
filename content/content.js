"use strict";

(() => {
  const parsed = self.parseSushiUrl(location.href);
  if (!parsed) return;

  const { series, seriesTitle, type, number, canonicalUrl } = parsed;

  const PANEL_ID = "manga-tracker-panel";
  const STATE_KEY = "panel.collapsed";
  const DEBOUNCE_MS = 1500;
  const MIN_TIME_ON_PAGE_MS = 30_000;

  const state = {
    currentPage: 0,
    totalPages: 0,
    images: [],
    seriesRecords: [],
    currentRecord: null,
    panelEl: null,
    collapsed: true,
    saveTimer: null,
    savePending: false,
  };

  let pageEntryTime = 0;

  init().catch((err) => console.error("[manga-tracker] init failed", err));

  async function init() {
    pageEntryTime = Date.now();
    state.collapsed = await readCollapsed();
    detectImages();
    state.seriesRecords = await sendMessage({
      type: "QUERY_SERIES",
      series,
    });
    state.currentRecord =
      state.seriesRecords.find((r) => r.url === canonicalUrl) || null;
    if (state.currentRecord && state.currentRecord.page) {
      state.currentPage = state.currentRecord.page;
    }

    mountPanel();
    if (state.images.length > 0) {
      attachIntersectionObserver();
      attachScrollListener();
      attachUnloadListener();
    } else {
      console.warn(
        "[manga-tracker] no manga images detected on this page — tracking disabled",
      );
    }
  }

  function detectImages() {
    const candidates = [
      "#readerarea img",
      ".ts-main-image",
      "main img.size-full",
    ];
    for (const sel of candidates) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length >= 3) {
        state.images = found;
        state.totalPages = found.length;
        return;
      }
    }
    const big = Array.from(document.querySelectorAll("img")).filter(
      (img) => (img.naturalHeight || img.height || 0) >= 500,
    );
    if (big.length >= 3) {
      state.images = big;
      state.totalPages = big.length;
    }
  }

  function attachIntersectionObserver() {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            const idx = state.images.indexOf(e.target);
            if (idx >= 0 && idx + 1 > state.currentPage) {
              state.currentPage = idx + 1;
              updateCurrentLine();
            }
          }
        }
        scheduleSave();
      },
      { threshold: [0.5] },
    );
    state.images.forEach((img) => io.observe(img));
  }

  function attachScrollListener() {
    window.addEventListener("scroll", scheduleSave, { passive: true });
  }

  function attachUnloadListener() {
    window.addEventListener("pagehide", () => {
      flushSave();
    });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSave();
    });
  }

  function resumeToPage(rec, btn) {
    const targetImg = state.images[rec.page - 1];
    if (!targetImg) {
      window.scrollTo({ top: rec.scrollY, behavior: "smooth" });
      return;
    }

    const preceding = state.images.slice(0, rec.page);
    const isReallyLoaded = (img) => {
      if (!img.complete || img.naturalHeight === 0) return false;
      if (img.dataset.src && img.src !== img.dataset.src) return false;
      return true;
    };

    const pending = new Set();
    preceding.forEach((img) => {
      if (isReallyLoaded(img)) return;
      pending.add(img);
      if (img.loading === "lazy") img.loading = "eager";
      if (img.dataset.src && img.src !== img.dataset.src) {
        img.src = img.dataset.src;
      }
      if (img.dataset.srcset && img.srcset !== img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
      }
    });

    let resolved = false;
    const restoreBtn = () => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "↻ Reprendre";
      }
    };
    const updateProgress = () => {
      if (!btn || resolved) return;
      const loaded = preceding.length - pending.size;
      btn.textContent = `Chargement ${loaded}/${preceding.length}…`;
    };
    const finish = () => {
      if (resolved) return;
      resolved = true;
      targetImg.scrollIntoView({ block: "start" });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          targetImg.scrollIntoView({ block: "start" });
          restoreBtn();
        });
      });
    };

    if (btn) {
      btn.disabled = true;
      updateProgress();
    }

    if (pending.size === 0) {
      finish();
      return;
    }

    pending.forEach((img) => {
      const onSettle = () => {
        if (resolved) return;
        pending.delete(img);
        if (pending.size === 0) finish();
        else updateProgress();
      };
      img.addEventListener("load", onSettle, { once: true });
      img.addEventListener("error", onSettle, { once: true });
    });

    setTimeout(() => {
      if (!resolved) finish();
    }, 60_000);
  }

  function scheduleSave() {
    state.savePending = true;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(flushSave, DEBOUNCE_MS);
  }

  function flushSave(force = false) {
    if (!state.savePending) return;
    if (!force && Date.now() - pageEntryTime < MIN_TIME_ON_PAGE_MS) return;
    const savedPage = (state.currentRecord && state.currentRecord.page) || 0;
    if (
      !force &&
      state.currentPage <= savedPage &&
      window.scrollY <
        ((state.currentRecord && state.currentRecord.scrollY) || 0)
    )
      return;
    state.savePending = false;
    clearTimeout(state.saveTimer);
    const payload = {
      url: canonicalUrl,
      series,
      seriesTitle,
      type,
      volume: number,
      page: state.currentPage || 1,
      totalPages: state.totalPages,
      scrollY: window.scrollY,
      timestamp: Date.now(),
    };
    sendMessage({ type: "SAVE_POSITION", payload }).catch((err) =>
      console.error("[manga-tracker] save failed", err),
    );
    const updated = {
      ...(state.currentRecord || {}),
      ...payload,
      firstVisitedAt:
        (state.currentRecord && state.currentRecord.firstVisitedAt) ||
        payload.timestamp,
      lastVisitedAt: payload.timestamp,
    };
    state.currentRecord = updated;
    const idx = state.seriesRecords.findIndex((r) => r.url === canonicalUrl);
    if (idx >= 0) state.seriesRecords[idx] = updated;
    else state.seriesRecords.push(updated);
    updateCurrentLine();
  }

  function computeViewportPage() {
    if (state.images.length === 0) return 0;
    const ref = window.scrollY + window.innerHeight * 0.4;
    let page = 1;
    for (let i = 0; i < state.images.length; i++) {
      const rect = state.images[i].getBoundingClientRect();
      const top = rect.top + window.scrollY;
      if (top <= ref) page = i + 1;
      else break;
    }
    return page;
  }

  // ----- UI -----

  function mountPanel() {
    const root = document.createElement("div");
    root.id = PANEL_ID;
    root.dataset.collapsed = String(state.collapsed);
    // Inline critical styles so the panel is visible even if CSS injection fails
    root.style.cssText =
      "position:fixed!important;bottom:16px!important;right:16px!important;" +
      "z-index:2147483647!important;display:block!important;";
    (document.body || document.documentElement).appendChild(root);
    state.panelEl = root;
    renderPanel();
  }

  function renderPanel() {
    if (!state.panelEl) return;
    const root = state.panelEl;
    root.dataset.collapsed = String(state.collapsed);
    root.innerHTML = "";
    if (state.collapsed) {
      root.appendChild(buildCollapsed());
    } else {
      root.appendChild(buildExpanded());
    }
  }

  function buildCollapsed() {
    const btn = document.createElement("button");
    btn.className = "mt-fab";
    btn.title = `${seriesTitle} — ${entryTypeLabel(type, number)}`;
    btn.textContent = "📖";
    // Inline fallback so button is always clickable even without CSS
    btn.style.cssText =
      "all:initial;display:flex!important;align-items:center;justify-content:center;" +
      "width:48px;height:48px;border-radius:50%;background:#1f2937;color:#fff;" +
      "font-size:22px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);border:none;";
    if (state.currentRecord && state.currentRecord.scrollY > 0) {
      const dot = document.createElement("span");
      dot.className = "mt-fab-dot";
      btn.appendChild(dot);
    }
    btn.addEventListener("click", () => toggleCollapsed());
    return btn;
  }

  function buildExpanded() {
    const wrap = document.createElement("div");
    wrap.className = "mt-panel";

    const header = document.createElement("div");
    header.className = "mt-header";
    const title = document.createElement("div");
    title.className = "mt-title";
    title.textContent = seriesTitle;
    const close = document.createElement("button");
    close.className = "mt-close";
    close.textContent = "×";
    close.title = "Replier";
    close.addEventListener("click", () => toggleCollapsed());
    header.appendChild(title);
    header.appendChild(close);
    wrap.appendChild(header);

    const list = document.createElement("ul");
    list.className = "mt-list";

    const records = sortRecords(state.seriesRecords, state.currentRecord);
    for (const rec of records) {
      list.appendChild(buildRow(rec));
    }
    if (records.length === 0) {
      const empty = document.createElement("li");
      empty.className = "mt-empty";
      empty.textContent = "Nouvelle lecture en cours…";
      list.appendChild(empty);
    }

    wrap.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "mt-footer";
    const saveBtn = document.createElement("button");
    saveBtn.className = "mt-save";
    saveBtn.textContent = "💾 Sauvegarder";
    saveBtn.addEventListener("click", () => {
      const viewportPage = computeViewportPage();
      if (viewportPage > 0) state.currentPage = viewportPage;
      state.savePending = true;
      flushSave(true);
      if (state.panelEl && !state.panelEl.querySelector(".mt-row-current")) {
        renderPanel();
      }
      const btn = state.panelEl && state.panelEl.querySelector(".mt-save");
      if (!btn) return;
      btn.textContent = "✓ Sauvegardé";
      btn.disabled = true;
      setTimeout(() => {
        const b = state.panelEl && state.panelEl.querySelector(".mt-save");
        if (b) {
          b.textContent = "💾 Sauvegarder";
          b.disabled = false;
        }
      }, 2000);
    });
    footer.appendChild(saveBtn);
    wrap.appendChild(footer);

    return wrap;
  }

  function sortRecords(records, current) {
    const map = new Map();
    for (const r of records) map.set(r.url, r);
    if (current && !map.has(current.url)) map.set(current.url, current);

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.url === canonicalUrl) return -1;
      if (b.url === canonicalUrl) return 1;
      return (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0);
    });
    return arr;
  }

  function buildRow(rec) {
    const li = document.createElement("li");
    li.className = "mt-row";
    const isCurrent = rec.url === canonicalUrl;
    if (isCurrent) li.classList.add("mt-row-current");

    const finished = rec.totalPages > 0 && rec.page >= rec.totalPages;
    const status = finished ? "✅" : "📖";

    const head = document.createElement("div");
    head.className = "mt-row-head";
    const label = document.createElement("a");
    label.className = "mt-row-label";
    label.href = rec.url;
    label.textContent = `${status} ${entryTypeLabel(rec.type, rec.volume)}`;
    head.appendChild(label);
    const meta = document.createElement("span");
    meta.className = "mt-row-meta";
    const pageInfo =
      rec.totalPages > 0
        ? `${rec.page || 1}/${rec.totalPages}`
        : `p.${rec.page || 1}`;
    meta.textContent = `${pageInfo} · ${formatRelative(rec.lastVisitedAt)}`;
    head.appendChild(meta);
    li.appendChild(head);

    if (isCurrent && rec.scrollY > 0) {
      const resumeBtn = document.createElement("button");
      resumeBtn.className = "mt-resume";
      resumeBtn.textContent = "↻ Reprendre";
      resumeBtn.addEventListener("click", () => {
        resumeToPage(rec, resumeBtn);
      });
      li.appendChild(resumeBtn);
    }
    return li;
  }

  function updateCurrentLine() {
    if (!state.panelEl || state.collapsed) return;
    const row = state.panelEl.querySelector(".mt-row-current .mt-row-meta");
    if (!row) return;
    const page =
      state.currentPage ||
      (state.currentRecord && state.currentRecord.page) ||
      1;
    const total =
      state.totalPages ||
      (state.currentRecord && state.currentRecord.totalPages) ||
      0;
    const pageInfo = total > 0 ? `${page}/${total}` : `p.${page}`;
    const ts = state.currentRecord && state.currentRecord.lastVisitedAt;
    row.textContent = `${pageInfo} · ${ts ? formatRelative(ts) : "non sauvegardé"}`;
  }

  async function toggleCollapsed() {
    state.collapsed = !state.collapsed;
    await writeCollapsed(state.collapsed);
    renderPanel();
  }

  // ----- helpers -----

  function entryTypeLabel(t, n) {
    if (t === "chapitre" || t === "chapter") return `Chapitre ${n}`;
    return `Volume ${n}`;
  }

  function sendMessage(msg) {
    return browser.runtime.sendMessage(msg);
  }

  async function readCollapsed() {
    try {
      const r = await browser.storage.local.get(STATE_KEY);
      return r[STATE_KEY] !== false;
    } catch {
      return true;
    }
  }

  async function writeCollapsed(v) {
    try {
      await browser.storage.local.set({ [STATE_KEY]: v });
    } catch {}
  }

  function formatRelative(ts) {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `il y a ${d} j`;
    const date = new Date(ts);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }
})();
