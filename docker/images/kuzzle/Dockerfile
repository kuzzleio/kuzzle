################################################################################
# Production build image
################################################################################
FROM node:12.18.1-stretch-slim as builder

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
  && tar xf /tmp/minify_2.7.4_linux_amd64.tar.gz -C /usr/bin/

ADD ./bin /app/bin
ADD ./config /app/config
ADD ./lib /app/lib
ADD ./package.json /app/package.json
ADD ./package-lock.json /app/package-lock.json
ADD ./index.js /app/index.js
ADD ./.kuzzlerc.sample /app/.kuzzlerc.sample

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies
RUN  npm install --production \
  && npm install -g --unsafe-perm --production \
      pm2

ADD ./docker/scripts/clean-node.sh /usr/bin/clean-node

ADD ./plugins/available/ /app/plugins/available/

RUN  set -x \
  # Link default plugins
  && mkdir -p /app/plugins/enabled/ \
  && ln -s /app/plugins/available/kuzzle-plugin-auth-passport-local /app/plugins/enabled/kuzzle-plugin-auth-passport-local \
  && ln -s /app/plugins/available/kuzzle-plugin-logger /app/plugins/enabled/kuzzle-plugin-logger \
  # Install plugins dependencies
  && for plugin in plugins/*/*; do npm install --production --prefix "$plugin"; done \
  # Clean Node.js related useless files
  && clean-node \
  && for plugin in plugins/*/*; do cd "$plugin"; echo "$plugin"; clean-node; cd /app; done \
  # Remove useless leftover dependencies
  && rm -rf node_modules/rxjs/ \
  # Strip binaries
  && strip node_modules/re2/build/Release/re2.node

################################################################################
# Production build 2 image
################################################################################
FROM node:12.18.1-stretch-slim as minifier

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
FROM bitnami/minideb:stretch

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

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
