################################################################################
FROM kuzzleio/kuzzle-runner:24-trixie-slim AS builder

WORKDIR /app

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
FROM kuzzleio/kuzzle-runner:24-trixie-slim AS minifier

ENV NODE_ENV=production

COPY --from=builder /app /app

RUN  set -x \
     && apt-get update \
     && apt-get clean autoclean \
     && apt-get autoremove --yes

################################################################################
FROM node:24-trixie-slim

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

WORKDIR /var/app

# tini runs as PID 1: it forwards signals to node and reaps child processes
# (Kuzzle forks one to renew its cluster ID card). See "Run Kuzzle under an
# init process" in the cluster guide.
RUN  set -x \
     && apt-get update \
     && apt-get install --yes --no-install-recommends tini \
     && rm -rf /var/lib/apt/lists/*

COPY --from=minifier /lib /lib
COPY --from=minifier /usr /usr
COPY --from=minifier /app/node_modules ./node_modules
COPY --from=minifier /app/package*.json ./
COPY --from=minifier /app/dist .

ENV NODE_ENV=production

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "./bin/start-kuzzle-server"]
