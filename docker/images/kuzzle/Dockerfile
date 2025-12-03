################################################################################
ARG NODE_VERSION="22"

FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY ./bin bin
COPY ./lib lib
COPY ./package.json package.json
COPY ./package-lock.json package-lock.json
COPY ./index.ts index.ts
COPY ./tsconfig.json tsconfig.json

RUN npm ci
RUN npm run build
RUN npm prune --omit=dev

################################################################################
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

WORKDIR /var/app

# Only copy what you actually need
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist .
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/lib ./lib

ENV NODE_ENV=production

CMD ["node", "./bin/start-kuzzle-server.js"]
