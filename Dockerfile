FROM kuzzleio/base

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Power your web, mobile & iot apps with the Kuzzle backend"

COPY ./ /var/app/
COPY ./docker-compose/scripts/run.sh /usr/local/bin/kuzzle

WORKDIR /var/app

RUN  apt-get update \
  && apt-get install -y \
    build-essential \
    curl \
    git \
    g++ \
    gdb \
    python \
  \
  && npm install --unsafe-perm -g pm2 \
  && npm install --unsafe-perm \
  && npm rebuild all --unsafe-perm \
  && for plugin in plugins/enabled/*; do cd "$plugin"; npm install --unsafe-perm; cd /var/app; done \
  \
  && chmod a+x /usr/local/bin/kuzzle \
  && chmod a+x /var/app/docker-compose/scripts/docker-entrypoint.sh \
  \
  && apt-get clean \
  && apt-get remove -y \
    build-essential \
    g++ \
    python \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/var/app/docker-compose/scripts/docker-entrypoint.sh"]
CMD ["kuzzle", "start"]
