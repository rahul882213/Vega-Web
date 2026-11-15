FROM node:20-slim

# Install ffmpeg and ffprobe for MKV/HEVC/EAC3 probing, subtitle extraction, and live remuxing
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

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
