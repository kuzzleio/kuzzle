################################################################################
# Production build image
################################################################################
FROM node:12.16.3-alpine3.11 as builder

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

ENV NODE_ENV=production

RUN  apk add --no-cache \
      curl \
      python \
      make \
      g++ \
      xz \
      zeromq-dev \
      binutils \
    && rm -rf /var/cache/apk/* \
    && curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | sh -s -- -b /usr/local/bin \
  # Install dependencies
  && npm install --production \
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
  # Remove useless leftover dependencies
  && rm -rf node_modules/rxjs/ \
  && rm -rf node_modules/boost-geospatial-index/include/ \
  # Remove useless text and object files
  && find / \( -name "*.md" -o -name "*.ts*" -o -name "*.txt" -o -name "*.o" \) | xargs rm \
  && rm -rf /usr/local/lib/node_modules/npm/changelogs/ \
  && rm -rf /usr/local/lib/node_modules/npm/man/ \
  && rm -rf /usr/local/lib/node_modules/npm/docs/ \
  # Strip binaries
  && strip node_modules/re2/build/Release/re2.node \
  && strip node_modules/re2/build/Release/obj.target/re2.node

################################################################################
# Production build 2 image
################################################################################
FROM node:12.16.3-alpine3.11 as minifier

COPY --from=builder /var/app /var/app

RUN  apk add --no-cache \
        xz \
        binutils \
  && strip /usr/local/bin/node \
  && apk del binutils \
  && tar cfJ /system.tar.xz /lib /usr \
  && tar cfJ /app.tar.xz /var/app

################################################################################
# Production image
################################################################################
FROM alpine:3.11.6 as kuzzle

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

ENV NODE_ENV=production

COPY --from=minifier /system.tar.xz /everest/system.tar.xz
COPY --from=builder /var/app/docker/scripts/entrypoint.sh /bin/entrypoint
COPY --from=builder /var/app/docker/scripts/extract.sh /bin/extract
COPY --from=builder /var/app/docker/scripts/run.sh /bin/kuzzle
COPY --from=minifier /app.tar.xz /everest/app.tar.xz

RUN  chmod a+x /bin/extract \
  && chmod a+x /bin/kuzzle

ENTRYPOINT ["/bin/entrypoint"]

CMD ["kuzzle", "start"]

