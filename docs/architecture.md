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

## Core architecture

Focus to the "Kuzzle kernel" above:
![archi_core](images/kuzzle_core_architecture.png)

### Main core components

* **Router Controller**: implements the 3 API routeurs, normalize input message and send them to the Funnel Controller
* **Funnel Controller**: analyses input message and call the appropriate controller (see [API specitifcation](api-specifications.md))
* **Admin Controller**, **Bulk Controller**, **Write Controller**, **Subscribe Controller**, **Read Controller**: handles input message (see [API specitifcation](api-specifications.md))
* **Internal Components** : Any components used internally by controller to interact with services

### Hooks

Hooks allow to attach some actions to some Kuzzle events.

As an example, Admin, Bulk and Writer controllers emit a "data:create" event to handle writing actions through storage engine.
This event will trigger the execution of the *add* method of the *write* hook, which will send the received message to the broker service.

It is then possible to implement custom hooks to trigger any events emitted by Kuzzle.

_For more details, see [hooks description](../lib/hooks/README.md)_

### Services

In Kuzzle, a Service module is the implementation of the interface to external services used by the application (AMQP broker, storage engine, cache engine, etc.)

_For more details, see [services description](../lib/services/README.md)_

### Workers

A Worker is a component that is designed to possibly run outside of the main Kuzzle instance.

Workers attach themselves to the broker service that is fed by Kuzzle to perform any kind of tasks.

As an example, the persistence to [elasticsearch]("https://www.elastic.co/products/elasticsearch") is implemented as a *write* worker in Kuzzle core.

Additionally, serveral Workers of the same type can be launched in parallel, on the same or a different host.

This flexibility allows the Kuzzle system administrators to leverage their resources consumption and distribute and/or scale their services as fits bests their needs.


_For more details, see [workers description](../lib/workers/README.md)_

