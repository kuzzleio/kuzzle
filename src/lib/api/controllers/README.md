# What is a Controller?

A controller handles a specific part of the Kuzzle architecture.

* adminController handles all the administration process
* bulkController handles batch/import operations into Elasticsearch
* funnelController handles the validation of the client request
* subscribeController handles the subscription actions from the client request
* hotelClerkController handles all subscription proccess (i.e from both client and from Kuzzle)
* rountingController handles dispating client request to other controllers
* readController handles the abstraction on reading persistant data. As default Kuzzle use Elasticsearch
* writeController handles the abstraction on writing persistant data. As default, Kuzzle use Elasticsearch.

Refer to [../../../docs/architecture.md] for details.

# Contributing

If you want to create your own Controller, you must :

* create the file in this directory
* initialize it in [start.js](../start.js)
* adding some routing in routerController (if relevant)
* add a service for your controller (see the section [contributing in services](../../services/README.md)) (if relevant)
