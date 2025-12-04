################################################################################
ARG NODE_VERSION="24"
FROM kuzzleio/kuzzle-runner:${NODE_VERSION} AS builder

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
FROM kuzzleio/kuzzle-runner:${NODE_VERSION} AS minifier

ENV NODE_ENV=production

COPY --from=builder /app /app

RUN  set -x \
     && apt-get update \
     && apt-get clean autoclean \
     && apt-get autoremove --yes

################################################################################
FROM node:${NODE_VERSION}-trixie-slim

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

WORKDIR /var/app

COPY --from=minifier /lib /lib
COPY --from=minifier /usr /usr
COPY --from=minifier /app/node_modules ./node_modules
COPY --from=minifier /app/package*.json ./
COPY --from=minifier /app/dist .

ENV NODE_ENV=production

CMD ["node", "./bin/start-kuzzle-server.js"]
