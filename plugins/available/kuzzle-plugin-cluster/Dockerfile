FROM kuzzleio/kuzzle:2

LABEL "io.kuzzle.vendor"="Kuzzle"

COPY . /var/app/plugins/available/cluster

ENV NODE_ENV production

RUN  set -x \
  \
  && apt-get update \
  && apt-get install --no-install-recommends --no-install-suggests -y \
    build-essential \
    python-dev \
    libzmq3-dev \
  \
  && ln -s /var/app/plugins/available/cluster /var/app/plugins/enabled/ \
  && cd /var/app/plugins/enabled/cluster \
  && npm install --unsafe-perm \
  && cp docker-compose/config/kuzzlerc.prod /etc/kuzzlerc \
  && cd /var/app \
  && echo done
