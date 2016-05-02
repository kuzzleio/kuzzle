# What is a Controller?

A controller handles a specific part of the Kuzzle architecture.

* adminController handles the actions that require some specific rights, such as the administration of the persistent data storage layer or the user rights definition
* bulkController handles batch/import operations into the persistent data storage layer
* funnelController handles the validation of the client request
* subscribeController handles the subscription actions from the client request
* routingController handles dispatching client requests to other controllers
* readController handles the abstraction on reading persistant data. As default Kuzzle use Elasticsearch
* writeController handles the abstraction on writing persistant data. As default, Kuzzle use Elasticsearch.
* securityController handles the abstraction on reading/writing data to manage rights, like Role, Profile and User. As default, Kuzzle use a specific index %kuzzle in Elasticsearch.

Refer to [architecture documentation](http://kuzzle.io/guide/#architecture) for details.

# Contributing

If you want to create your own Controller, you must :

* create the file in this directory
* initialize it in [start.js](../start.js)
* eventually add client requests routes in the routerController
* add a service for your controller (see the section [contributing in services](../../services/README.md)) (if relevant)
