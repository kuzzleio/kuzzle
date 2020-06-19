################################################################################
# Production build image
################################################################################
FROM node:12.16.3-stretch-slim as builder

ADD ./bin /app/bin
ADD ./config /app/config
ADD ./lib /app/lib
ADD ./package.json /app/package.json
ADD ./package-lock.json /app/package-lock.json
ADD ./default.config.js /app/default.config.js

WORKDIR /app

ENV NODE_ENV=production

RUN  set -x \
  && apt-get update && apt-get install -y \
       curl \
       python \
       make \
       g++ \
       python \
       libzmq3-dev \
  && curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | sh -s -- -b /usr/local/bin \
  && curl -L https://github.com/tdewolff/minify/releases/download/v2.7.4/minify_2.7.4_linux_amd64.tar.gz > /tmp/minify_2.7.4_linux_amd64.tar.gz \
  && tar xf /tmp/minify_2.7.4_linux_amd64.tar.gz -C /usr/bin/ \
  # Install dependencies
  && npm install --production

ADD ./docker/scripts/everest-clean-node.sh /usr/bin/everest-clean-node

ADD ./plugins/available/ /app/plugins/available/

RUN  set -x \
  # Link default plugins
  && mkdir -p /app/plugins/enabled/ \
  && ln -s /app/plugins/available/kuzzle-plugin-auth-passport-local /app/plugins/enabled/kuzzle-plugin-auth-passport-local \
  && ln -s /app/plugins/available/kuzzle-plugin-logger /app/plugins/enabled/kuzzle-plugin-logger \
  # Install plugins dependencies
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm install --production; cd /app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm install --production; cd /app; done \
  # Clean Node.js related useless files
  && everest-clean-node \
  && for plugin in plugins/enabled/*; do cd "$plugin"; echo "$plugin"; everest-clean-node; cd /app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; echo "$plugin"; everest-clean-node; cd /app; done \
  # Remove useless leftover dependencies
  && rm -rf node_modules/rxjs/ \
  # Strip binaries
  && strip node_modules/re2/build/Release/re2.node

################################################################################
# Production build 2 image
################################################################################
FROM node:12.16.3-stretch-slim as minifier

ENV NODE_ENV=production

ADD ./docker/scripts/everest-compress.sh /usr/bin/everest-compress

COPY --from=builder /app /app

RUN  set -x \
  && apt-get update && apt-get install -y xz-utils binutils \
  && strip /usr/local/bin/node \
  && apt-get remove -y binutils xz-utils \
  && apt-get clean autoclean \
  && apt-get autoremove --yes \
  && rm -rf /var/lib/{apt,dpkg,cache,log}/

################################################################################
# Production image
################################################################################
FROM bitnami/minideb:stretch as kuzzle

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

COPY --from=minifier /lib /lib
COPY --from=minifier /usr /usr
COPY --from=minifier /app /var/app

ENV NODE_ENV=production

ADD ./docker/scripts/promises.sh /promises.sh
ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/run-prod.sh /bin/kuzzle

ENTRYPOINT ["/bin/entrypoint"]

RUN ln -s /var/app /app

CMD ["kuzzle", "start"]

