# What is a Service?

In Kuzzle, a Service module is the implementation of the interface to a different component of the application (think of a *system* service).

Kuzzle currently implements the following Services:

* [broker.js](./broker.js): interfaces to MQTT compatible broker ([RabbitMQ](https://www.rabbitmq.com/) by default).
* [elasticsearch.js](./elasticsearch.js): interfaces to [Elasticsearch](https://www.elastic.co/products/elasticsearch).
* [redis.js](./redis.js): interfaces to [redis](http://redis.io) cache server.
* [index.js](./index.js): The module entry point to intialize all the services to engine.


Service can be added to different engines. As an exemple, Elasticsearch is used for the writeEngine and the readEngine (see [index.js](./index.js)).


# Contributing


## Modifying the service in an existing engine

Kuzzle use Elasticsearch by default. As an example, if we want to use MongoDB we must :

* create a file mongodb.js in the services directory
* replace "./elasticsearch.js" by  "./mongodb.js" in [./index.js](./index.js)
* create src/lib/config/models/mongodb.js 
* edit [src/lib/config/index.js](../../../src/lib/config/index.js) and add mongodb.js models
* create the test and doc !


## Adding an engine with an exisiting service

Kuzzle use redis service for the cache engine notification.

As an example, you may want to reuse the redis service to create an engine for caching user session.

You can see how elasticsearch service is already used in both writeEngine and readEngine for this purpose in [index.js](./index.js).
