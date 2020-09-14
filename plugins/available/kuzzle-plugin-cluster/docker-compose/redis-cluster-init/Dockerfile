FROM redis:5.0-alpine

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"

RUN  set -x \
  && apk add --no-cache bind-tools

COPY docker-entrypoint.sh /

ENTRYPOINT [ "/docker-entrypoint.sh" ]
