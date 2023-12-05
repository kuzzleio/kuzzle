################################################################################
# Production build image
################################################################################
ARG NODE_LTS_VERSION="18"
FROM node:${NODE_LTS_VERSION}-bullseye-slim AS builder

RUN  set -x \
 && apt-get update \
 && apt-get install -y \
      curl \
      python \
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
ADD ./.kuzzlerc.sample.jsonc .kuzzlerc.sample.jsonc

RUN npm ci
RUN npm run build
RUN npm prune --production

RUN rm -rf tsconfig.json index.ts

ADD ./plugins/available/ /app/plugins/available/

################################################################################
# Production build 2 image
################################################################################
FROM node:${NODE_LTS_VERSION}-bullseye-slim AS minifier

ENV NODE_ENV=production

COPY --from=builder /app /app

RUN  set -x \
 && apt-get update && apt-get install -y \
      curl \
 && apt-get clean autoclean \
 && apt-get autoremove --yes

################################################################################
# Production image
################################################################################
FROM node:${NODE_LTS_VERSION}-bullseye-slim

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
