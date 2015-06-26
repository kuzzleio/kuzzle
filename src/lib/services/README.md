# What is a Service?

In Kuzzle, a Service module is the implementation of the interface to a different component of the application (think of a *system* service).

Kuzzle currently implements the following Services:

* [broker.js](./broker.js): interfaces to MQTT compatible broker ([RabbitMQ](https://www.rabbitmq.com/) by default).
* [elasticsearch.js](./elasticsearch.js): interfaces to [elasticsearch](https://www.elastic.co/products/elasticsearch).
* [redis.js](./redis.js): interfaces to [redis](http://redis.io) cache server.

Service can be added to different engines. As an exemple, elasticsearch is added as a writeEngine and a readEngine (see [index.js](./index.js))


# index.js

The module entry point to intialize all the services.
Will be launch via kuzzle constructor.


# Contributing

Kuzzle use Elasticsearch by default.

As an example, if we want to use MongoDB instead we must :

* create a file mongodb.js in the services directory
* replace "./elasticsearch.js" by  "./mongodb.js" in [index.js](./index.js)
* create src/lib/config/models/mongodb.js 
* edit [src/lib/config/index.js](../../../src/lib/config/index.js) to add mongodb.js models
* create the test and doc !


As an other example, you can also reuse the redis service for caching session.
