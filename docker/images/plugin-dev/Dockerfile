################################################################################
# Plugin development build image
################################################################################
FROM node:12.16.3-stretch-slim as builder

ADD ./bin /app/bin
ADD ./config /app/config
ADD ./lib /app/lib
ADD ./package.json /app/package.json
ADD ./package-lock.json /app/package-lock.json
ADD ./default.config.js /app/default.config.js

WORKDIR /app

RUN  set -x \
  && apt-get update && apt-get install -y \
       curl \
       python \
       make \
       g++ \
       python \
       libzmq3-dev \
  && npm install -g --unsafe-perm --production \
    nodemon \
    kourou \
  && curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | sh -s -- -b /usr/local/bin \
  && rm -rf /var/lib/apt/lists/* \
  # Install dependencies
  && npm install --production

ADD ./docker/scripts/everest-clean-node.sh /usr/bin/everest-clean-node
ADD ./docker/scripts/everest-compress.sh /usr/bin/everest-compress

ADD ./plugins/available/ /app/plugins/available/

RUN  set -x \
  # Link default plugins
  && mkdir -p /app/plugins/enabled/ \
  && ln -s /app/plugins/available/kuzzle-plugin-auth-passport-local /app/plugins/enabled/kuzzle-plugin-auth-passport-local \
  && ln -s /app/plugins/available/kuzzle-plugin-logger /app/plugins/enabled/kuzzle-plugin-logger \
  # Install plugins dependencies
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm install --production --unsafe-perm; cd /app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm install --production -unsafe-perm; cd /app; done \
  # Clean Node.js related useless files
  && everest-clean-node \
  && for plugin in plugins/enabled/*; do cd "$plugin"; echo "$plugin"; everest-clean-node; cd /app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; echo "$plugin"; everest-clean-node; cd /app; done \
  # Remove useless leftover dependencies
  && rm -rf node_modules/rxjs/ \
  # Strip binaries
  && strip /usr/local/bin/node \
  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node \
  # Create system archives
  && everest-compress lib usr app

################################################################################
# Plugin development image
################################################################################
FROM debian:stretch-slim as plugin-dev

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Develop new plugin or protocol for Kuzzle with ease"

ADD ./docker/scripts/promises.sh /promises.sh
ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/everest-extract.sh /bin/everest-extract
ADD ./docker/scripts/run-plugin.sh /bin/run-plugin

COPY --from=builder /usr/bin/xz /bin/xz
COPY --from=builder /everest /everest

RUN  set -x \
  # && apt-get update && apt-get install -y xz-utils \
  # && rm -rf /var/lib/apt/lists/* \
  && rm /bin/sh \
  && ln -s /bin/bash /bin/sh

ENTRYPOINT ["/bin/entrypoint"]
