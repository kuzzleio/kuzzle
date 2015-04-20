FROM kuzzle:base
MAINTAINER Kaliop Labs

RUN npm install -g \
    grunt-cli \
    jslint \
    grunt-jslint \
    node-inspector@0.9.2

ADD /scripts /
RUN chmod 755 /*.sh

EXPOSE 8080

CMD ["/run.sh"]