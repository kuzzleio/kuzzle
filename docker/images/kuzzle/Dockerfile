################################################################################
ARG NODE_VERSION="20"
FROM node:${NODE_VERSION}-bookworm-slim AS builder

RUN set -x \
     \
     && apt-get update \
     && apt-get install -y \
     bash-completion \
     build-essential \
     curl \
     g++ \
     gdb \
     git \
     gnupg \
     libfontconfig \
     libzmq3-dev \
     python3 \
     procps \
     wget \
     libunwind-dev \
     && npm install -g kourou \
     && apt-get clean \
     && rm -rf /var/lib/apt/lists/*

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

COPY ./plugins/available/ /app/plugins/available/

################################################################################
FROM node:${NODE_VERSION}-bookworm-slim AS minifier

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

RUN set -x \
     && apt-get update && apt-get install -y \
     libunwind-dev

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
