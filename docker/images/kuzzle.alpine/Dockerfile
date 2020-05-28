################################################################################
# Production build image
################################################################################
FROM node:12.16.3-alpine3.11 as builder

ADD ./bin /var/app/bin
ADD ./config /var/app/config

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
  # Install dependencies
  && npm install --production \
  # Remove useless JS related files
  && /usr/local/bin/node-prune \
  && for plugin in plugins/enabled/*; do cd "$plugin"; /usr/local/bin/node-prune; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; /usr/local/bin/node-prune; cd /var/app; done \
  && rm /usr/local/bin/node-prune \
  # Remove non-production dependencies
  && npm prune --production \
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm prune --production; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm prune --production; cd /var/app; done \
  # Remove git repositories
  # @todo remove tests dir
  && for plugin in plugins/enabled/*; do cd "$plugin"; rm -rf .git/ test/; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; rm -rf .git/ test/; cd /var/app; done \
  # Remove useless leftover dependencies
  && rm -rf node_modules/rxjs/ \
  # Remove useless files
  && find . -type d \( -name "man" -o \) | xargs rm -rf \
  && find . -type f \( -name "*.o"  -o -name "*.h" -o -name "package-lock.json" -o -name "*.mk" -o -name "*Makefile*" -o -name "*.c" -o -name "*.cpp" -o -name "*.hpp" \) | xargs rm \
  # Strip binaries
  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node \
  # Minify JS & JSON
  && curl -L https://github.com/tdewolff/minify/releases/download/v2.7.4/minify_2.7.4_linux_amd64.tar.gz > /tmp/minify_2.7.4_linux_amd64.tar.gz \
  && tar xf /tmp/minify_2.7.4_linux_amd64.tar.gz -C /tmp \
  && for file in $(find . \( -name "*.json" -o -name "*.js" \)); do /tmp/minify $file -o $file; done


################################################################################
# Production build 2 image
################################################################################
FROM node:12.16.3-alpine3.11 as minifier

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
    /usr/bin/ldd \
  && tar cfJ /usr.tar.xz /usr \
  && tar cfJ /app.tar.xz /var/app

################################################################################
# Production image
################################################################################
FROM scratch as kuzzle

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

ENV NODE_ENV=production

ADD ./docker/scripts/promises.sh /promises.sh
ADD ./docker/scripts/entrypoint.sh /bin/entrypoint
ADD ./docker/scripts/extract.sh /bin/extract
ADD ./docker/scripts/run.sh /bin/kuzzle

COPY --from=minifier /etc /etc
COPY --from=minifier /bin /bin
COPY --from=minifier /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1

COPY --from=minifier /usr.tar.xz /everest/usr.tar.xz
COPY --from=minifier /app.tar.xz /everest/app.tar.xz

RUN  chmod a+x /bin/extract \
  && chmod a+x /bin/kuzzle \
  && ln -s /lib/ld-musl-x86_64.so.1 /lib/libc.musl-x86_64.so.1

ENTRYPOINT ["/bin/entrypoint"]

CMD ["kuzzle", "start"]

