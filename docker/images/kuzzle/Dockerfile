################################################################################
# Production build image
################################################################################
FROM node:18-bullseye-slim as builder

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

ADD ./bin /app/bin
ADD ./config /app/config
ADD ./lib /app/lib
ADD ./package.json /app/package.json
ADD ./package-lock.json /app/package-lock.json
ADD ./index.js /app/index.js
ADD ./.kuzzlerc.sample.jsonc /app/.kuzzlerc.sample.jsonc

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies
RUN npm install --production \
 && npm install -g --unsafe-perm --production \
      pm2

ADD ./docker/scripts/clean-node.sh /usr/bin/clean-node

ADD ./plugins/available/ /app/plugins/available/

RUN  set -x \
  # Remove useless leftover dependencies
 && rm -rf node_modules/rxjs/ \
  # Strip binaries
  ; strip node_modules/re2/build/Release/re2.node \
  ; true

################################################################################
# Production build 2 image
################################################################################
FROM node:18-bullseye-slim as minifier

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
FROM bitnami/minideb:bullseye

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
