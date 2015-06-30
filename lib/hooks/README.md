# What is a Hook?

Hooks allow to attach actions to Kuzzle events.

The list of available events and their default attached actions can be found in the [config/hooks.js](../config/hooks.js) file.

As an example, when the "data:create" event is emitted by kuzzle, it will trigger the execution of the *add* method of the *write* hook, which will send the received message to the broker.

# Contributing

You can define and add your own custom hooks.

A hook must be a valid node.js module that implements an init() function.

The init function is passed to the current kuzzle instance object.

Your module must be placed in the /lib/hooks directory.

You can then attach your hook to some events by editing the [config/hooks.js](../config/hooks.js) configuration file.