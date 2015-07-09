# What is a Service?

In Kuzzle, a Service module is the implementation of the interface to a different component of the application (think of a *system* service).

Kuzzle currently implements the following Services:

* [broker.js](./broker.js): interface to a AMQP compatible broker ([RabbitMQ](https://www.rabbitmq.com/) by default).
* [elasticsearch.js](./elasticsearch.js): interface to [Elasticsearch](https://www.elastic.co/products/elasticsearch), used for persistent data storage.
* [redis.js](./redis.js): interface to the [redis](http://redis.io) cache server.
* [logger.js](./logger.js): interface to the [Logstash](https://www.elastic.co/products/logstash) server.
* [index.js](./index.js): module entry point. Used to initialize all implemented services.


A Service can be added to different engines. As an exemple, Elasticsearch is used by both the writeEngine and the readEngine (see [index.js](./index.js)).


# logger.js

The Logger is an interface to Logstash that we used to monitore the Kuzzle state.
As an exemple if we want to log each data creation for analysis purpose, you just have to call :
```js
	kuzzle.emit('data:create', data);

```

and add in the [hooks](../../lib/config/hooks.js) the entry :

```js
  'data:create': ['log:log']
```

Every call to emit will add an entry to the logstash server.


# Contributing


## Use a different service for an existing Kuzzle engine

For instance, Kuzzle use Elasticsearch for persistent data storage. If we want to use MongoDB instead, we have to:

* create a file mongodb.js in the services directory
* replace the "./elasticsearch.js" by "./mongodb.js" in the [./index.js](./index.js)
* create the lib/config/models/mongodb.js file
* edit the [lib/config/index.js](../config/index.js) and add mongodb.js models
* implement unit/functional testing
* write the new service documentation


## Use an existing service for a new Kuzzle engine

Kuzzle use Redis for its notification engine.
You may want to reuse this Redis service to, for instance, store user sessions.

You can see how elasticsearch service is already used by both the writeEngine and the readEngine for this purpose in the [index.js](./index.js).
