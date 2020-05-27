################################################################################
# Plugin development build image
################################################################################
FROM node:12.16.3-stretch-slim as builder

ADD ./bin /var/app/bin
ADD ./config /var/app/config
ADD ./docker /var/app/docker

ADD ./lib /var/app/lib

ADD ./plugins/available/kuzzle-plugin-auth-passport-local /var/app/plugins/available/kuzzle-plugin-auth-passport-local
# @todo remove when cluster is integrated
ADD ./plugins/available/kuzzle-plugin-cluster /var/app/plugins/available/kuzzle-plugin-cluster
ADD ./plugins/available/kuzzle-plugin-logger /var/app/plugins/available/kuzzle-plugin-logger
ADD ./plugins/enabled /var/app/plugins/enabled

ADD ./package.json /var/app/package.json
ADD ./package-lock.json /var/app/package-lock.json
ADD ./default.config.js /var/app/default.config.js

WORKDIR /var/app

RUN  set -x \
  && apt-get update && apt-get install -y \
       curl \
       python \
       make \
       g++ \
       python \
       libzmq3-dev \
  && npm set progress=false \
  && npm install -g --unsafe-perm --production \
    nodemon \
    kourou \
  && curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | sh -s -- -b /usr/local/bin \
  && rm -rf /var/lib/apt/lists/* \
  # Install NPM dependencies
  && npm install --production --unsafe-perm \
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm install --production --unsafe-perm; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm install --production -unsafe-perm; cd /var/app; done \
  # Remove useless JS related files
  &&  /usr/local/bin/node-prune \
  && for plugin in plugins/enabled/*; do cd "$plugin"; /usr/local/bin/node-prune; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; /usr/local/bin/node-prune; cd /var/app; done \
  && rm /usr/local/bin/node-prune \
  # Remove non-production dependencies
  && npm prune --production \
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm prune --production; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm prune --production; cd /var/app; done \
  # Remove git repositories
  && for plugin in plugins/enabled/*; do cd "$plugin"; rm -rf .git/; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; rm -rf .git/; cd /var/app; done \
  # Remove useless text and object files
  && find / \( -name "*.md" -o -name "*.ts*" -o -name "*.txt" -o -name "*.o" \) | xargs rm \
  && rm -rf /usr/local/lib/node_modules/npm/changelogs/ \
  && rm -rf /usr/local/lib/node_modules/npm/man/ \
  && rm -rf /usr/local/lib/node_modules/npm/docs/ \
  # Strip binaries
  && strip /usr/local/bin/node \
  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node \
  # Create system and app archives
  && tar cfJ /lib.tar.xz /lib \
  && tar cfJ /usr.tar.xz /usr \
  && tar cfJ /app.tar.xz /var/app

################################################################################
# Plugin development image
################################################################################
FROM debian:stretch-slim as plugin-dev

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Develop new plugin or protocol for Kuzzle with ease"

ADD ./docker/scripts/promises.sh /promises.sh
ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/extract.sh /bin/extract
ADD ./docker/scripts/run-plugin.sh /bin/run-plugin

COPY --from=builder /usr/bin/xz /bin/xz
COPY --from=builder /lib.tar.xz /everest/lib.tar.xz
COPY --from=builder /usr.tar.xz /everest/usr.tar.xz
COPY --from=builder /app.tar.xz /everest/app.tar.xz

RUN  set -x \
  && apt-get update \
  && apt-get install xz-utils \
  && rm /bin/sh \
  && ln -s /bin/bash /bin/sh \
  && chmod a+x /bin/extract \
  && chmod a+x /bin/run-plugin

ENTRYPOINT ["/bin/entrypoint"]
