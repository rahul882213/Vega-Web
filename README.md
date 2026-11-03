# Vega Web

Exact web browser version of the [Vega application](https://vega.8man.in/) (`Zenda-Cross/vega-app`), recreated for web browsers with the same Material 3 dark interface, provider extension runtime, live content discovery, and browser video player.

## Features

- **Authentic Vega Interface**: Material 3 dark theme (`#121318` surface, `#FF6B00` Vega primary accent), bottom navigation (`Home`, `Search`, `Library`, `Downloads`, `Settings`), and identical modal/sheet workflows.
- **Vega Provider Extension System**:
  - Add provider repositories (`Zenda-Cross/vega-providers` pre-configured) or custom manifest URLs.
  - Validate, install, update, enable/disable, and uninstall providers (`posts.js`, `meta.js`, `stream.js`, `episodes.js`, `catalog.js`).
  - Full `providerContext` runtime (`axios`, `cheerio`, `Crypto`, `getBaseUrl`, `extractors`, `kvStore`, `openWebView`) with server-side CORS and cookie bypass.
- **Live Content Discovery & Metadata**:
  - Dynamic home catalogs, hero banner with IMDb/Cinemeta enrichment, genre filters, and multi-provider search.
  - Full Movie & Series detail pages with season/episode selectors, cast, synopsis, watchlist, and direct downloads.
- **Vega Browser Video Player**:
  - Top bar with back button, lock controls, sleep timer, server/quality indicator pill, and decoder mode switch (`HW` Live Remux / `SW` Transcode / `DIR` Direct).
  - Double-tap gesture zones, skip-interval timeline ticks, hover time-diff preview, audio track switcher (`ffprobe` + `ffmpeg` live multi-audio mapping), embedded MKV subtitle extraction to WebVTT, playback speed, and external player launcher (VLC, PotPlayer, IINA, MPV, Android Intent).

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.
