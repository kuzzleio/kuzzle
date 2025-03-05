ARG ELASTICSEARCH_VERSION="7.17.26"
FROM docker.elastic.co/elasticsearch/elasticsearch:${ELASTICSEARCH_VERSION}

LABEL maintainer="kuzzle" contact="<support@kuzzle.io>"

COPY jvm.options /usr/share/elasticsearch/config/jvm.options

ENV ES_JAVA_OPTS="-Xms512m -Xmx512m"

ENV cluster.name=kuzzle
ENV node.name=alyx
ENV discovery.type=single-node
ENV ingest.geoip.downloader.enabled=false
