################################################################################
# Plugin development image
################################################################################
FROM debian:stretch-slim as plugin-dev

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Develop new plugin or protocol for Kuzzle with ease"

ENV NODE_VERSION=12.18.0
ENV PATH=/opt/node-v$NODE_VERSION-linux-x64/bin:$PATH

ADD https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz /tmp/

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
  && tar xf /tmp/node-v$NODE_VERSION-linux-x64.tar.gz -C /opt/ \
  && rm /tmp/node-v$NODE_VERSION-linux-x64.tar.gz \
  && mkdir -p /var/app \
  && npm install -g npm \
  && npm set progress=false \
  && npm install -g --unsafe-perm nodemon kourou pm2 \
  && rm -rf /var/lib/apt/lists/* \
  && echo "alias ll=\"ls -lahF --color\"" >> ~/.bashrc

ADD . /var/app

WORKDIR /var/app

RUN  npm install --unsafe-perm \
  && npm rebuild all --unsafe-perm \
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm install --unsafe-perm; cd /var/app; done \
  && for plugin in plugins/available/*; do cd "$plugin"; npm install --unsafe-perm; cd /var/app; done

################################################################################
# Production image
################################################################################
FROM debian:stretch-slim as kuzzle

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Run your Kuzzle backend in production mode"

ENV NODE_VERSION=12.18.0
ENV NODE_ENV=production
ENV PATH=/opt/node-v$NODE_VERSION-linux-x64/bin:$PATH

RUN  apt-get update \
  && apt-get install -y \
       curl \
       libkrb5-dev \
       libzmq3-dev \
  && rm -rf /var/lib/apt/lists/*

COPY --from=plugin-dev /var/app /var/app
COPY --from=plugin-dev /opt/node-v$NODE_VERSION-linux-x64 /opt/node-v$NODE_VERSION-linux-x64

RUN  npm remove -g nodemon kourou

RUN  ln -s /var/app/docker-compose/scripts/run.sh /usr/local/bin/kuzzle \
  && chmod a+x /usr/local/bin/kuzzle \
  && chmod a+x /var/app/docker-compose/scripts/docker-entrypoint.sh

WORKDIR /var/app

ENTRYPOINT ["/var/app/docker-compose/scripts/docker-entrypoint.sh"]

CMD ["kuzzle", "start"]
