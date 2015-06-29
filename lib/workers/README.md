# What is a Worker?

A Worker is a component that is designed to possibly run outside of the main Kuzzle instance.

Workers attach themselves to the broker that is fed by Kuzzle to perform any kind of tasks.

As an example, the persistence to [Elasticsearch](https://www.elastic.co/products/elasticsearch) is implemented as a Worker in Kuzzle core.

Additionally, serveral Workers of the same type can be launched in parallel, on the same or a different host.

This flexibility allows the Kuzzle system administrators to leverage their resources consumption and distribute and/or scale their services as fits bests their needs.

# Contributing

You can create your own custom Worker. You will then need to create a module that implements the init() function in the src/lib/workers directory.

The init function is passed to the kuzzle object (used to transport the configuration, the Kuzzle main application does not actually need to run).

Once your module is ready, you can activate it in the [src/lib/config/workers.js](../config/workers.js) configuration file.

Please feel free to share your Workers to the community by submitting a pull request.
We're looking forward them.
