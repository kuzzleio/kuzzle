# Kuzzle Architecture

## Global overview

![archi1](images/kuzzle_functional_architecture.png)

Kuzzle Kernel API can be accessed by 3 different ways  :
1. via a [RESTFul API](api-specifications.md#REST)
1. via a [Websocket connexion](api-specifications.md#Websocket), using our [Javascript SDK](https://stash.kaliop.net/projects/LABS/repos/kuzzle-sdk-js)
1. or via a [messaging broker](api-specifications.md#AMQP-STOMP-MQTT) such as RabbitMQ (using any protocol supported by your broker, such as AMQP, MQTT, STOMP)

In backgroiund, Kuzzle uses :
* a noSQL engine to store, index and search contents (we user Elasticsearch by default)
* a cache engine to store subscribtions list in cache (we use redis by default).

## Kuzzle components
