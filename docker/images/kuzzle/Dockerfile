################################################################################
ARG NODE_VERSION="22"
FROM kuzzleio/kuzzle-runner:${NODE_VERSION} AS builder

WORKDIR /app

COPY ./bin bin
COPY ./config config
COPY ./lib lib
COPY ./package.json package.json
COPY ./package-lock.json package-lock.json
COPY ./index.ts index.ts
COPY ./tsconfig.json tsconfig.json
COPY ./check-node-version.js check-node-version.js

RUN npm ci
RUN npm run build
RUN npm prune --omit=dev

RUN rm -rf tsconfig.json index.ts

################################################################################
FROM kuzzleio/kuzzle-runner AS minifier

ENV NODE_ENV=production

COPY --from=builder /app /app

RUN  set -x \
     && apt-get update && apt-get install -y \
     curl \
     && apt-get clean autoclean \
     && apt-get autoremove --yes

################################################################################
FROM node:${NODE_VERSION}-bookworm-slim

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

COPY --from=minifier /lib /lib
COPY --from=minifier /usr /usr
COPY --from=minifier /app /var/app

ENV NODE_ENV=production

COPY ./docker/scripts/entrypoint.sh /bin/entrypoint
COPY ./docker/scripts/run-prod.sh /bin/kuzzle

RUN ln -s /var/app /app

WORKDIR /var/app

ENV PATH=$PATH:/var/app/bin

ENTRYPOINT ["/bin/entrypoint"]

CMD ["kuzzle", "start"]
