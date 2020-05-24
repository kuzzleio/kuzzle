################################################################################
# Plugin development image
################################################################################
FROM node:12.16.3-stretch-slim as plugin-dev

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Develop new plugin or protocol for Kuzzle with ease"

ADD . /var/app

WORKDIR /var/app

RUN  set -x \
  \
  && apt-get update && apt-get install -y \
       bash-completion \
       build-essential \
       curl \
       g++ \
       gdb \
       git \
       python \
       libfontconfig \
       libkrb5-dev \
       libzmq3-dev \
       procps \
       wget \
  && mkdir -p /var/app \
  && npm set progress=false \
  && npm install -g --unsafe-perm nodemon kourou \
  && rm -rf /var/lib/apt/lists/* \
  && echo "alias ll=\"ls -lahF --color\"" >> ~/.bashrc \

# Some cleaning
  && npm install --unsafe-perm \
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm install --unsafe-perm; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm install --unsafe-perm; cd /var/app; done \

  && curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | bash -s -- -b /usr/local/bin \
  && /usr/local/bin/node-prune \
  && for plugin in plugins/enabled/*; do cd "$plugin"; /usr/local/bin/node-prune; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; /usr/local/bin/node-prune; cd /var/app; done \
  && rm /usr/local/bin/node-prune \

  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node \
  && find node_modules/ -name "*.o" | xargs rm \

  && rm -rf /usr/local/lib/node_modules/npm/docs/ \
  && rm -rf /usr/local/lib/node_modules/npm/man/ \
  && rm -rf /usr/local/lib/node_modules/npm/changelogs/ \
  && rm -rf /opt/yarn-*/

################################################################################
# Production build image
################################################################################
FROM node:12.16.3-stretch-slim  as kuzzle-build

COPY --from=plugin-dev /var/app/bin /var/app/bin
COPY --from=plugin-dev /var/app/config /var/app/config
COPY --from=plugin-dev /var/app/docker-compose /var/app/docker-compose

COPY --from=plugin-dev /var/app/lib /var/app/lib
COPY --from=plugin-dev /var/app/node_modules /var/app/node_modules

COPY --from=plugin-dev /var/app/plugins/available/kuzzle-plugin-auth-passport-local /var/app/plugins/available/kuzzle-plugin-auth-passport-local
# @todo remove when cluster is integrated
COPY --from=plugin-dev /var/app/plugins/available/kuzzle-plugin-cluster /var/app/plugins/available/kuzzle-plugin-cluster
COPY --from=plugin-dev /var/app/plugins/available/kuzzle-plugin-logger /var/app/plugins/available/kuzzle-plugin-logger
COPY --from=plugin-dev /var/app/plugins/enabled /var/app/plugins/enabled

COPY --from=plugin-dev /var/app/package.json /var/app/package.json
COPY --from=plugin-dev /var/app/package-lock.json /var/app/package-lock.json
COPY --from=plugin-dev /var/app/default.config.js /var/app/default.config.js

WORKDIR /var/app

RUN npm prune --production \
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm prune --production; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm prune --production; cd /var/app; done \

  && for plugin in plugins/enabled/*; do cd "$plugin"; rm -rf .git/; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; rm -rf .git/; cd /var/app; done \

  && rm -rf node_modules/rxjs/ \
  && rm -rf node_modules/boost-geospatial-index/include/ \

  && cd / && tar cfJ app.tar.xz /var/app

################################################################################
# Production image
################################################################################
FROM node:12.16.3-alpine3.11 as kuzzle

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

ENV NODE_ENV=production

COPY --from=kuzzle-build /var/app/docker-compose/scripts/run.sh /usr/local/bin/kuzzle

COPY --from=kuzzle-build /app.tar.xz /app.tar.xz

RUN  apk update \
  && apk add --no-cache curl \
  && ln -s /lib/libc.musl-x86_64.so.1 /lib/ld-linux-x86-64.so.2 \
  && chmod a+x /usr/local/bin/kuzzle \
  && rm -rf /var/cache/apk/*

CMD ["kuzzle", "start"]
