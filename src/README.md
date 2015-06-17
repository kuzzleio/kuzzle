<p align=center> ![logo](docs/images/logo.png)

# About Kuzzle

For UI and linked objects developers, Kuzzle is an open-source solution that handles all the data managment
(CRUD, real-time storage, search, high-level features, etc;).
Kuzzle features are accessible through a secured API, with a large choice of protocols.

This project use RabbitMQ and Elasticsearch behind the scene.

# Important Note

This NPM package can be run alone but we encourage to use the [Docker version](https://registry.hub.docker.com/u/klabs) for get a packaged version with all in the box. 

# Installation

## Default

Prerequisites (this is why we recommend the [Docker version](https://registry.hub.docker.com/u/klabs)) :

* Node installed with npm
* A service [RabbitMQ](https://www.rabbitmq.com/) running on localhost:5672
* A service [Elasticsearch](https://www.elastic.co/products/elasticsearch) running on localhost:9200 

```bash
$ npm install kuzzle
$ cd kuzzle
$ kuzzle start
```

You can now access to the api on http://localhost:8081/api/. If you want to change the port you can run

```bash
$ kuzzle start --port 8082
```

Or, if you have [PM2](https://github.com/Unitech/pm2)

```bash
$ pm2 start app-start.js
```


## Change RabbitMQ and Elasticsearch host

If you are not running RabbitMQ and Elasticsearch on localhost, you can configure host and port (on Linux):

```bash
$ export ELASTICSEARCH_HOST=myelasticsearch:9200
$ export RABBIT_HOST=myrabbitmq:5672
$ kuzzle start
```


# Tests

Run tests (unit & features) with `npm test`


# Contributing to Kuzzle

_(to be completed...)_


# Full documentation

See [full documentation](docs/index.md)


# License

See [licence](license.md)