################################################################################
# Production build image
################################################################################
FROM node:12.16.3-alpine3.11 as builder

ADD ./bin /app/bin
ADD ./config /app/config
ADD ./lib /app/lib
ADD ./package.json /app/package.json
ADD ./package-lock.json /app/package-lock.json
ADD ./default.config.js /app/default.config.js

WORKDIR /app

ENV NODE_ENV=production

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
  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node

################################################################################
# Production build 2 image
################################################################################
FROM node:12.16.3-alpine3.11 as everest-minifier

ENV NODE_ENV=production

ADD ./docker/scripts/everest-compress.sh /usr/bin/everest-compress

COPY --from=builder /app /app

RUN  set -x \
  && apk add --no-cache \
        xz \
        binutils \
  && strip /usr/local/bin/node \
  && apk del binutils \
  && rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/include/node/ \
    /usr/local/share \
    /usr/local/*.md \
    /usr/share \
    /usr/bin/getent \
    /usr/bin/lzmainfo \
    /usr/bin/ssl_client \
    /usr/bin/scanelf \
    /usr/bin/iconv \
    /usr/bin/getconf \
    /usr/bin/lzmadec \
    /usr/bin/xzmore \
    /usr/bin/xzless \
    /usr/bin/xzgrep \
    /usr/bin/xzdiff \
    /usr/bin/xzdec \
    /usr/bin/ldd \
  # Create system archives
  && cd / \
  && everest-compress usr app

################################################################################
# Production image
################################################################################
FROM scratch as kuzzle

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

ENV NODE_ENV=production

ADD ./docker/scripts/promises.sh /promises.sh
ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/everest-extract.sh /bin/everest-extract
ADD ./docker/scripts/run.sh /bin/kuzzle

COPY --from=everest-minifier /etc /etc
COPY --from=everest-minifier /bin /bin
COPY --from=everest-minifier /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1

COPY --from=everest-minifier /everest /everest/

RUN  ln -s /lib/ld-musl-x86_64.so.1 /lib/libc.musl-x86_64.so.1

ENTRYPOINT ["/bin/entrypoint"]

CMD ["kuzzle", "start"]

