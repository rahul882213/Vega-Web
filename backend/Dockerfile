FROM node:20-slim

# Install ffmpeg, ffprobe, curl, and tor for MKV/HEVC probing, subtitle extraction, live remuxing, and non-US tunnel fallback
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl tor \
  && rm -rf /var/lib/apt/lists/* \
  && ARCH=$(dpkg --print-architecture) \
  && WP_ARCH=$([ "$ARCH" = "arm64" ] && echo "arm64" || echo "amd64") \
  && curl -fsSL "https://github.com/pufferffish/wireproxy/releases/download/v1.1.3/wireproxy_linux_${WP_ARCH}.tar.gz" -o /tmp/wireproxy.tar.gz \
  && tar -xzf /tmp/wireproxy.tar.gz -C /usr/local/bin wireproxy \
  && chmod +x /usr/local/bin/wireproxy \
  && rm -f /tmp/wireproxy.tar.gz

WORKDIR /app

# Support both Docker build contexts on Render:
# 1) Repository root context (.) with Dockerfile Path = backend/Dockerfile
# 2) Backend directory context (backend/) with Root Directory = backend
COPY . /tmp/context
RUN if [ -f /tmp/context/backend/package.json ] && [ -f /tmp/context/backend/server.js ]; then \
      cp /tmp/context/backend/package.json /tmp/context/backend/server.js /app/; \
    elif [ -f /tmp/context/package.json ] && [ -f /tmp/context/server.js ]; then \
      cp /tmp/context/package.json /tmp/context/server.js /app/; \
    else \
      echo "ERROR: Could not locate backend package.json and server.js in Docker build context" >&2 && exit 1; \
    fi \
  && rm -rf /tmp/context \
  && npm install --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
