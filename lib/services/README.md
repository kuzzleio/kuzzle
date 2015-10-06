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


# Logging/Monitoring/Profiling

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

## Profiling

The profiling service is designed to get time spent in internal functions. This service is useful during the development process to try to understand where we wasted time.  
We use [nodegrind](https://www.npmjs.com/package/nodegrind) to output a file for each request that can be analyzed by [Blackfire](https://blackfire.io) or other software compatible with [KCachegrind](http://kcachegrind.sourceforge.net/html/Home.html) format.

When Kuzzle is running, open a new terminal and run:

```
$ kuzzle enable profiling
```

When you're done with profiling, you can disable it with:

```
$ kuzzle disable profiling
```

Output files are generated in the `profiling` folder. To use them you can use the container [blackfire-upload](https://github.com/kuzzleio/kuzzle-containers/tree/master/blackfire-upload) created by Kuzzle team to upload them to Blackfire.

```
$ docker run --rm -ti \
    -e BLACKFIRE_CLIENT_ID=$BLACKFIRE_CLIENT_ID \
    -e BLACKFIRE_CLIENT_TOKEN=$BLACKFIRE_CLIENT_TOKEN \
    -v paht/to/profiling/:/profiling \
    kuzzleio/blackfire-upload ./aggregate.sh
```

For each request made, this service creates a new file. In the `profiling` folder, files are generated with the format:

* `<controller>-<protocol>-<timestamp>-<requestId>` for profiling in the main kuzzle server
* `worker-<worker name>-<protocol>-<timestamp>-<requestId>` for profiling in workers

Two profiling files are generated because workers and the main server are not running on the same thread.

**Note:**

* You don't have to reload Kuzzle when you enable/disable profiling.
* If you're not using the Docker version, you have to install [Nodegrind](https://www.npmjs.com/package/nodegrind) because it must be installed globally with `npm install -g nodegrind@0.4.0`
* **Don't** use the profiling during benchmark: for each request made, a minimum of two files will be created.
* Avoid to mix different controllers if you don't want to aggregate the results. It doesn't make sense to send profiling on controller `write` and `read`.


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
$ kuzzle enable profiling
```

And you can disable the service with

```
$ kuzzle disable profiling
```

## Currently available services

Currently, there is a list of available services through the remote action:

* [`profiling`](#profiling)

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
