FROM kuzzleio/base:alpine
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/
ADD ./docker-compose/scripts/run.sh /run.sh
ADD ./docker-compose/config/pm2.json /config/pm2.json

RUN set -ex && \
    apk add \
      build-base \
      git \
      python && \
    npm install && \
    apk del --purge \
      build-base \
      python
