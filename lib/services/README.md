# What is a Service?

In Kuzzle, a Service module is the implementation of the interface to different components of the application (think of a *system* service).

A Service can be added to different engines. For example, Elasticsearch is used by both the writeEngine and the readEngine (see [index.js](./index.js)).

## Available services

All services including a ``toggle`` function can be enabled/disabled remotely using the Remote Action controller.

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
