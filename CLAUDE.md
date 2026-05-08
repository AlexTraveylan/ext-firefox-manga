# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## No build step

This is a plain Manifest V3 Firefox extension. There is no bundler, no transpilation, no `package.json`. Files are loaded directly by Firefox.

## Loading / testing the extension

```bash
# Temporary load (lasts until Firefox restart)
# In Firefox: about:debugging#/runtime/this-firefox → "Charger un module complémentaire temporaire…" → select manifest.json

# Package a .xpi manually
zip -r -FS manga-tracker.xpi * -x "*.git*" "*.md" ".github/*" "assets/*"
```

The CI workflow (`.github/workflows/release.yml`) builds and publishes the `.xpi` automatically on any `vX.Y.Z` tag push. It patches `manifest.json` with the tag version before zipping.

## Debugging

Open `about:debugging#/runtime/this-firefox` → Inspect the extension → Console tab, filter on `[manga-tracker]`.
IndexedDB data: Storage tab → Indexed Storage → `https://sushiscan.net` → `manga-tracker` → `volumes`.

## Architecture — message flow

```
content.js  ──sendMessage──▶  background.js  ──▶  lib/db.js (IndexedDB)
     ▲                               │
     └─────────── response ──────────┘
```

- `lib/url-parser.js` runs in the content script context (loaded before `content.js`). It exposes `parseSushiUrl()` on `self`. If the URL doesn't match, `content.js` exits immediately.
- `content.js` is one big IIFE injected at `document_idle`. It owns all UI state and drives saves via `IntersectionObserver` + debounced scroll.
- `background.js` is a thin router: it delegates `SAVE_POSITION` to `handleSave()` and `QUERY_SERIES` / `GET_VOLUME` directly to `MangaDb`.
- `lib/db.js` wraps IndexedDB with a lazy singleton (`openDb()`). The object store key is the full canonical URL. There is one secondary index on `series` (used by `QUERY_SERIES`) and one on `lastVisitedAt` (unused for now).

## URL parsing

`parseSushiUrl()` matches URLs of the form:

```
/{series-slug}-(volume|chapitre|chapter)-{N}/
```

It returns `{ series, type, number, seriesTitle, canonicalUrl }`.  
In `content.js`, `number` is stored to the DB as the `volume` field (for backward compatibility). The `type` field (`"volume"` | `"chapitre"` | `"chapter"`) drives the UI label via `entryTypeLabel()`.

## DB record schema

```js
{
  url: string,           // keyPath — canonical URL with trailing slash
  series: string,        // slug (indexed)
  seriesTitle: string,
  type: string,          // "volume" | "chapitre" | "chapter"
  volume: number,        // entry number (chapter or volume)
  page: number,
  totalPages: number,
  scrollY: number,
  firstVisitedAt: number,
  lastVisitedAt: number  // indexed
}
```

## Image detection heuristic

`detectImages()` in `content.js` tries CSS selectors in order (`#readerarea img`, `.ts-main-image`, `main img.size-full`), then falls back to any `<img>` with `height >= 500px`. If sushiscan changes its DOM and tracking breaks, this is the first place to look.
