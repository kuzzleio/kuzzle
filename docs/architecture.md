# Kuzzle Architecture

## Global overview

![archi_fonctionnal](images/kuzzle_functional_architecture.png)

Kuzzle Kernel API can be accessed by 3 different ways:
1. a [RESTFul API](api-specifications.md#REST)
2. a [Websocket connexion](api-specifications.md#Websocket), using Kuzzle [Javascript SDK](https://stash.kaliop.net/projects/LABS/repos/kuzzle-sdk-js)
3. or a [messaging broker](api-specifications.md#AMQP-STOMP-MQTT) such as RabbitMQ (using any protocol supported by your broker, such as AMQP, MQTT, STOMP)

In background, Kuzzle uses:
* a noSQL engine to store, index and search contents (we use Elasticsearch by default).
* a cache engine to store subscribtions list (we use redis by default).

## Kuzzle components
