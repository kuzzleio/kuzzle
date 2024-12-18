################################################################################
ARG NODE_VERSION="20"
FROM node:${NODE_VERSION}-bookworm-slim AS builder

RUN  set -x \
  && apt-get update && apt-get install -y \
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

RUN npm ci
RUN npm run build
RUN npm prune --omit=dev

RUN rm -rf tsconfig.json index.ts

ADD ./plugins/available/ plugins/available/

################################################################################
FROM node:${NODE_VERSION}-bookworm-slim

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Develop new plugin or protocol for Kuzzle with ease"

WORKDIR /var/app

RUN set -x \
  && apt-get update && apt-get install -y \
  libunwind-dev

ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/run-plugin.sh /bin/run-plugin

COPY --from=builder /lib /lib
COPY --from=builder /usr /usr
COPY --from=builder /app /var/app

RUN  set -x \
  && rm /bin/sh \
  && ln -s /bin/bash /bin/sh \
  && ln -s /var/app /app

WORKDIR /var/app

ENV PATH=$PATH:/var/app/bin

ENTRYPOINT ["/bin/entrypoint"]

CMD ["/bin/run-plugin"]
