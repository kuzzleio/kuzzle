################################################################################
# Production build image
################################################################################
FROM node:12.18.1-alpine3.11 as builder

RUN  set -x \
  && apk add --no-cache \
      curl \
      python \
      make \
      g++ \
      xz \
      zeromq-dev \
      binutils \
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
RUN  npm install --production

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
  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node

################################################################################
# Production image
################################################################################
FROM node:12.18.1-alpine3.11

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode with alpine"

ENV NODE_ENV=production

ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/run-prod.sh /bin/kuzzle

COPY --from=builder /app /var/app

WORKDIR /var/app

ENV PATH=$PATH:/var/app/bin

ENTRYPOINT ["/bin/entrypoint"]

CMD ["kuzzle", "start"]
