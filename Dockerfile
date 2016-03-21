FROM kuzzleio/base:alpine
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/

RUN set -ex && \
    apk add \
      build-base \
      git \
      python && \
    npm install && \
    apk del --purge \
      build-base \
      python
