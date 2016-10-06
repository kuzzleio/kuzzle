FROM kuzzleio/base
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/
ADD ./docker-compose/scripts/run.sh /run.sh
ADD ./docker-compose/config/pm2.json /config/pm2.json

RUN npm install
