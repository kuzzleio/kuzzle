################################################################################
ARG NODE_VERSION="20"
FROM node:${NODE_VERSION}-bookworm-slim AS builder

RUN  set -x \
     && apt-get update \
     && apt-get install -y \
     curl \
     make \
     g++ \
     python3 \
     libzmq3-dev \
     libunwind-dev

WORKDIR /app

ADD ./bin bin
ADD ./config config
ADD ./lib lib
ADD ./package.json package.json
ADD ./package-lock.json package-lock.json
ADD ./index.ts index.ts
ADD ./tsconfig.json tsconfig.json

RUN npm ci --noproxy registry.npmjs.org --maxsockets 1
RUN npm run build
RUN npm prune --omit=dev

RUN rm -rf tsconfig.json index.ts

ADD ./plugins/available/ /app/plugins/available/

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

ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/run-prod.sh /bin/kuzzle

RUN ln -s /var/app /app

WORKDIR /var/app

ENV PATH=$PATH:/var/app/bin

ENTRYPOINT ["/bin/entrypoint"]

CMD ["kuzzle", "start"]
