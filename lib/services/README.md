# What is a Service?

In Kuzzle, a Service module is the implementation of the interface to a different component of the application (think of a *system* service).

Kuzzle currently implements the following Services:

* [broker.js](./broker.js): interfaces to MQTT compatible broker ([RabbitMQ]("https://www.rabbitmq.com/") by default).
* [elasticsearch.js](./elasticsearch.js): interfaces to [elasticsearch]("https://www.elastic.co/products/elasticsearch").
* [redis.js](./redis.js): interfaces to [redis]("http://redis.io") cache server.
