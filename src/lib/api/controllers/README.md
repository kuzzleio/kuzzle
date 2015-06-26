# What is a Controller?

Controller handle a specific part of the Kuzzle architecture.

* adminController handle all the administration process
* bulkController handle batching/import operation to Elasticsearch 
* funnelController handle validation client request
* subscribeController handle subscription actions from client request
* hotelClerkController handle all subscription proccess (i.e from both client and from Kuzzle)
* readController handle the abstraction on reading persistant data. As default Kuzzle use Elasticsearch
* rountingController handle dispating client request to other controllers
* writeController handle the abstraction on writing persistant data. As default, Kuzzle use Elasticsearch.
* readController handle the abstraction on writing persistant data. As default, Kuzzle use Elasticsearch.

Refer to [link-to-scheme] in src for details.

# Contributing

If you want to create your own Controller, you must :

* create the file in this directory
* initialize it in [start.js](../start.js)
* adding some routing in routerController (if relevant)
* add a service for your controller (see section [contributing in services](../../services/README.md)) (if relevant)
