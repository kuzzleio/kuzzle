<p align=center> ![logo](docs/images/logo.png)

# About Kuzzle

For UI and linked objects developers, Kuzzle is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc;).

Kuzzle features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols (see [Specifications](docs/api-specifications.md) for details).

Kuzzle use [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html) (see [filters syntax](docs/filters.md) for more details) as filtering language, [RabbitMQ](https://www.rabbitmq.com/) for managing queues and [Redis](http://redis.io/) for manage filter cache.

# Installation

## Using the all-in-one Docker recipe

If you are running Docker and just want to get your own kuzzle running, you can use the provided docker-compose file.

Prerequisites:

* [Docker](https://docs.docker.com/installation/#installation)
* [Docker Compose](https://docs.docker.com/compose/install/)

From Kuzzle's root directory:

    $ docker-compose up

You can now access to the websocket api on http://localhost:8081/api/.

## Using Vagrant

If you are not running Docker on your system, for instance if you are running Windows or MacOs, you can pop a virtual machine to run Kuzzle.

Prerequisites:

* [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant](https://www.vagrantup.com/)

From the root directory:

    $ vagrant up

Once the virtual machine is provisionned, you should be able to access Kuzzle's websocket api on http://localhost:8081/api/.

## From source or npm

First of all, you have to get this code, you can use NPM or clone this repo.

* NPM

    ```
    $ npm install kuzzle
    ```

* GIT

    ```
    $ git clone https://github.com/kuzzleio/kuzzle.git
    $ cd kuzzle && npm install
    ```

## Manual install

### Default

Prerequisites:

* A service [RabbitMQ](https://www.rabbitmq.com/) running on localhost:5672
* A service [Elasticsearch](https://www.elastic.co/products/elasticsearch) running on localhost:9200
* A service [Redis](http://redis.io/) running on localhost:6379

```bash
$ kuzzle start
```

You can now access to the api with http://localhost:8081/api/. If you want to change the port you can run

```bash
$ kuzzle start --port 8082
```

Or, if you have [PM2](https://github.com/Unitech/pm2)

```bash
$ pm2 start app-start.js
```

### Change RabbitMQ and Elasticsearch host

If you are not running RabbitMQ and Elasticsearch on localhost, you can configure host and port:

```bash
$ export ELASTICSEARCH_HOST=myelasticsearch:9200
$ export RABBIT_HOST=myrabbitmq:5672
$ kuzzle start
```


# Tests

## Unit test

    $ npm run unit-testing

## Features

If you are using the all-in-one Docker recipe of vagrant box, the easiest and recommanded way of launching the test suite is from within the Kuzzle container.

```bash
$ docker exec -ti kuzzle_kuzzle_1 bash
```

From vagrant:

```bash
$ vagrant ssh -c 'docker exec -ti kuzzle_kuzzle_1 bash'
```

If for some reason, you want to launch the tests from your host on the source files, you will need to manually launch all the required dependencies.
(see Manual install above).

Then, you can run:

    $ npm run functional-testing


# Contributing to Kuzzle

_(to be completed...)_


# Full documentation

See [full documentation](docs/index.md)


# Acknowledgement

Thanks to [Sails](https://github.com/balderdashy/sails) project for a good Node.js infrastructure example.

# License

Kuzzle is published under the [Apache 2 License](LICENSE.md).
