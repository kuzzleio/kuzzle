ARG REDIS_VERSION=5
FROM redis:$REDIS_VERSION
MAINTAINER Kuzzle <support@kuzzle.io>

COPY redis.conf /usr/local/etc/redis/redis.conf

CMD [ "redis-server", "/usr/local/etc/redis/redis.conf" ]
