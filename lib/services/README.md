# What is a Service?

In Kuzzle, a Service module is the implementation of the interface to different components of the application (think of a *system* service).

Kuzzle currently implements the following Services:

* [rabbit.js](./rabbit.js): interface to [RabbitMQ](https://www.rabbitmq.com/)
* [elasticsearch.js](./elasticsearch.js): interface to [Elasticsearch](https://www.elastic.co/products/elasticsearch), used for persistent data storage.
* [redis.js](./redis.js): interface to the [redis](http://redis.io) cache server.
* [logger.js](./logger.js): interface to the [Logstash](https://www.elastic.co/products/logstash) server.
* [ipc.js](./ipc.js): IPC implementation of the internal message broker
* [index.js](./index.js): module entry point. Used to initialize all implemented services.


A Service can be added to different engines. For example, Elasticsearch is used by both the writeEngine and the readEngine (see [index.js](./index.js)).


# Logging/Monitoring

The main purpose for those subjects is to detect latency and problems in Kuzzle. In many cases, you don't have to enable them if you're not a contributor.

## perf.js

The perf service is an interface to Logstash that we used to monitor the Kuzzle state.
As an exemple if we want to log each data creation for analysis purpose, you just have to call:

```
  kuzzle.emit('write:rest:start', data);
```

and add to the [hooks](../../lib/config/hooks.js) the entry:

```
  'write:rest:start': ['perf:log']
```

Every call to emit will add an entry to the logstash server.


## Monitoring

The monitoring service allows to show response time for each protocol, controller and action call.
You can monitor your Kuzzle with [Newrelic](http://newrelic.com/) by adding environment variables (both required):

* NEW_RELIC_APP_NAME: The Newrelic application name that will be displayed in Newrelic dashboard.
* NEW_RELIC_LICENSE_KEY: Your New Relic [license key](https://docs.newrelic.com/docs/subscriptions/license-key).

**Note:**

* If you're using Docker, you can directly add those variables in docker-compose.yml
* You have to reload Kuzzle when you change those variables

# Remote action

The `remoteActions` service allows to enable/disable services when Kuzzle is running without reload. When a Kuzzle process is started, in the terminal you can do something like


```
$ kuzzle enable mqBroker <pid>
```

And you can disable the service with

```
$ kuzzle disable mqBroker <pid>
```

## Available services

All services including a ``toggle`` function can be enabled/disabled remotely using the Remote Action service.

# Contributing

## Use a different service for an existing Kuzzle engine

For instance, Kuzzle uses Elasticsearch for persistent data storage. If we want to use MongoDB instead, we have to:

* create a file mongodb.js in the services directory
* replace the "./elasticsearch.js" by "./mongodb.js" in the [./index.js](./index.js)
* create the lib/config/models/mongodb.js file
* edit the [lib/config/index.js](../config/index.js) and add mongodb.js models
* implement unit/functional testing
* write the new service documentation


## Use an existing service for a new Kuzzle engine
Kuzzle uses Redis for its notification engine.
You may want to reuse this Redis service to, for instance, store user sessions.

You can see how elasticsearch service is already used by both the writeEngine and the readEngine for this purpose in the [index.js](./index.js).
