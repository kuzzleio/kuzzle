################################################################################
# Plugin development build image
################################################################################
FROM node:18-bullseye-slim as builder

RUN  set -x \
  && apt-get update && apt-get install -y \
       curl \
       make \
       g++ \
       python3 \
       libzmq3-dev \
       libunwind-dev \
  && npm install -g --unsafe-perm --production \
    ergol \
    kourou \
    pm2 \
  && curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | sh -s -- -b /usr/local/bin

ADD ./bin /app/bin
ADD ./config /app/config
ADD ./lib /app/lib
ADD ./package.json /app/package.json
ADD ./package-lock.json /app/package-lock.json
ADD ./index.js /app/index.js
ADD ./.kuzzlerc.sample.jsonc /app/.kuzzlerc.sample.jsonc


WORKDIR /app

# Install dependencies
RUN  npm ci --production

ADD ./plugins/available/ /app/plugins/available/

################################################################################
# Plugin development image
################################################################################
FROM bitnami/minideb:bullseye

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
