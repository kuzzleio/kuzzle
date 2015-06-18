<p align=center> ![logo](docs/images/logo.png)

# About Kuzzle

For UI and linked objects developers, Kuzzle is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc;).

Kuzzle features are accessible through a secured API, with a large choice of protocols.
It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols (see [Specifications](src/docs/specifications.md) for details).

Kuzzle use [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html) (see [filters syntax](docs/filters.md) for more details) as filtering language and RabbitMQ for managing queues. 

# Installation

First of all, you have to get this code, you can use NPM or clone this repo.

NPM

     $ npm install kuzzle
     
GIT

     $ npm clone https://github.com/kuzzleio/kuzzle.git

## All in the box with Docker

You can find a docker-compose.yml file in this repository. The aim of this file is to simplify the Kuzzle deployment.

Prerequisites:

* [Install docker](https://docs.docker.com/installation/#installation)
* [Install docker-compose](https://docs.docker.com/compose/install/)

Then, you can simply do

     $ docker-compose up

Elasticsearch and RabbitMQ will be launched. You can now access to the api with http://localhost:8081/api/.
If you want to customize the docker-compose file, you can copy this file into docker-compose-custom.yml and edit it

     $ docker-compose -f docker-compose-custom.yml up

## Manual install

### Default

Prerequisites:

* A service [RabbitMQ](https://www.rabbitmq.com/) running on localhost:5672
* A service [Elasticsearch](https://www.elastic.co/products/elasticsearch) running on localhost:9200 

```bash
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

### Change RabbitMQ and Elasticsearch host

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


# Acknowledgement

Thanks to [Sails](https://github.com/balderdashy/sails) project for a good NPM package infrastructure example.

# License

See [licence](LICENSE.md)