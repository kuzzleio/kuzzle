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

ADD ./bin /var/app/bin
ADD ./config /var/app/config
ADD ./lib /var/app/lib
ADD ./package.json /var/app/package.json
ADD ./package-lock.json /var/app/package-lock.json
ADD ./index.js /app/index.js
ADD ./.kuzzlerc.sample /app/.kuzzlerc.sample

WORKDIR /var/app

ENV NODE_ENV=production

# Install dependencies
RUN  npm install --production

ADD ./docker/scripts/clean-node.sh /usr/bin/clean-node

ADD ./plugins/available/ /var/app/plugins/available/

RUN  set -x \
  # Remove useless leftover dependencies
  && rm -rf node_modules/rxjs/ \
  # Strip binaries
  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node

################################################################################
# Production minifier image
################################################################################
FROM node:12.18.1-alpine3.11 as minifier

ENV NODE_ENV=production

COPY --from=builder /var/app /var/app

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
    /usr/bin/ldd

RUN tar czf /app.tar.gz /var/app

################################################################################
# Production image
################################################################################
FROM scratch

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode with scratch image"

ENV NODE_ENV=production

ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/run-prod.sh /bin/kuzzle

COPY --from=minifier /etc /etc
COPY --from=minifier /bin /bin
COPY --from=minifier /usr /usr
COPY --from=minifier /app.tar.gz /app.tar.gz
COPY --from=minifier /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1

RUN ln -s /lib/ld-musl-x86_64.so.1 /lib/libc.musl-x86_64.so.1

WORKDIR /var/app

ENV PATH=$PATH:/var/app/bin

ENTRYPOINT ["/bin/entrypoint"]

CMD ["kuzzle", "start"]

