FROM kuzzleio/dev
MAINTAINER Kuzzle <support@kuzzle.io>

ADD ./ /var/app/

RUN npm install