FROM rabbitmq
MAINTAINER Kaliop Labs

ENV http_proxy http://proxy.infra.lan:3128
ENV https_proxy http://proxy.infra.lan:3128
ENV no_proxy "172.16.*, 172.17.*, localhost, *.infra.lan, *.loc"

RUN rabbitmq-plugins enable rabbitmq_stomp
RUN rabbitmq-plugins enable rabbitmq_mqtt
