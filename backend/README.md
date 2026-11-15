# Vega Web Standalone Backend

Standalone Node.js Express backend replacing the deleted Netlify serverless backend for `Vega-Web`.

## Endpoints

- `GET /api/health` (and `GET /health`): Health status, uptime, and FFmpeg/FFprobe availability.
- `POST /api/proxy` (and `POST /api/edge-proxy`): Full HTTP/2 + HTTP/1.1 provider proxy with custom headers, cookies, redirect control, and base64 payloads.
- `GET /api/base-url`: Dynamic provider domain resolution (`Zenda-Cross/vega-providers`, `punisher-303/providers`, and live portal mirror checks).
- `POST /api/crypto/digest`: Hash digest helper (`MD5`, `SHA-1`, `SHA-256`, `SHA-384`, `SHA-512`).
- `GET /api/stream-proxy`: Byte-range (`206`) media streaming, HTTP/2 CDN proxy, subtitle proxy, and HLS `.m3u8` manifest rewriter.
- `GET /api/probe-stream`: Media stream metadata probe (`ffprobe`).
- `GET /api/subtitle-extract`: Embedded subtitle extraction to WebVTT (`ffmpeg`).
- `GET /api/transcode-stream`: Live FFmpeg remux (`hw`) and software transcode (`sw`) for MKV/HEVC/AC3/EAC3 playback.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port to bind (`0.0.0.0`). |
| `NODE_ENV` | `production` | Runtime environment mode. |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins (set to `https://rahul882213.github.io` in production, or `*`). |
| `UPSTREAM_TIMEOUT_MS` | `30000` | Upstream HTTP request timeout in ms. |
| `MODFLIX_TTL_MS` | `3600000` | Provider base-url cache TTL in ms. |

## Local Run

```bash
cd backend
npm install
npm start
```

## Deployment Options

### Option 1: Render (Docker — includes FFmpeg/FFprobe)
1. Push your repository to GitHub (`main` branch).
2. In Render Dashboard, choose **New + -> Web Service** and connect `rahul882213/Vega-Web`.
3. Choose **Runtime: Docker**:
   - Either set **Dockerfile Path** to `backend/Dockerfile` (default repository root `.` context), **OR** set **Root Directory** to `backend` with **Dockerfile Path** `Dockerfile`.
   - Set **Health Check Path** to `/api/health`.
4. Add environment variables:
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://rahul882213.github.io`
5. Deploy and copy your live service URL (e.g. `https://vega-web-backend.onrender.com`).

### Option 2: Railway / Koyeb / Fly.io
1. Deploy from the `backend/` root directory using `backend/Dockerfile` (or `npm start` for proxy-only mode without FFmpeg transcoding).
2. Set `ALLOWED_ORIGINS=https://rahul882213.github.io` (and `PORT` if required by the platform).
3. Verify `GET https://<your-backend-url>/api/health` returns `{"ok":true,...}`.

### Connect to GitHub Pages Frontend
- Option A (Build default): Set `VITE_REMOTE_BACKEND_URL=https://<your-backend-url>` before running `npm run build` and publishing `dist/` to `gh-pages`.
- Option B (Runtime Settings): Open your GitHub Pages site -> **Settings -> API & Stream Backend -> Remote Proxy Server**, paste `https://<your-backend-url>`, and click **Save**.
