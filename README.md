<p align=center> ![logo](docs/images/logo.png)

# About Kuzzle

For UI and linked objects developers, Kuzzle is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc;).

Kuzzle features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols (see [Specifications](docs/api-specifications.md) for details).

Kuzzle uses [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html) (see [filters syntax](docs/filters.md) for more details) as filtering language, [RabbitMQ](https://www.rabbitmq.com/) for managing queues and [Redis](http://redis.io/) for managing filter cache.

# Installation

## Using the all-in-one Docker recipe

If you are running Docker and just want to get your own Kuzzle running, you can use the provided docker-compose file.

Prerequisites:

* [Docker](https://docs.docker.com/installation/#installation)
* [Docker Compose](https://docs.docker.com/compose/install/)

From Kuzzle's root directory:

    $ docker-compose up

You can now access Kuzzle's API.

## Using Vagrant

If you are not running Docker on your system, for instance if you are running Windows or MacOs, you can pop a virtual machine to run Kuzzle.

Prerequisites:

* [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant](https://www.vagrantup.com/)

From the root directory:

    $ vagrant up

Once the virtual machine is provisioned, you should be able to access Kuzzle's API.

## From source or NPM

First of all, you have to get the source code. You can use NPM or clone our GIT repository.

* NPM

    ```
    $ npm install kuzzle
    ```

* GIT

    ```
    $ git clone https://github.com/kuzzleio/kuzzle.git
    $ cd kuzzle
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

To get a list of available options, you can run:

```bash
$ kuzzle start -h
```

You may also start Kuzzle by using [PM2](https://github.com/Unitech/pm2):

```bash
$ pm2 start app-start.js
```

### Change RabbitMQ and Elasticsearch hosts

If you are not running RabbitMQ and Elasticsearch on localhost, you can configure host and port:

```bash
$ export ELASTICSEARCH_HOST=myelasticsearch:9200
$ export RABBIT_HOST=myrabbitmq:5672
$ kuzzle start
```

# Using Kuzzle

Your applications can now connect to Kuzzle. We provide a few ways to do this:

* Using one of our SDK (coming soon)
* Directly, by accessing one of our API ([REST](docs/API.REST.md), [WebSocket](docs/API.WebSocket.md), [AMQP](docs/API.AMQP.md), [MQTT](docs/API.MQTT.md) or [STOMP](docs/API.STOMP.md))

# Running Tests

    $ npm test
Because functional tests need a running Kuzzle environment, it is recommended to run these tests from within a Kuzzle container.
<!--Because functional tests need to be done in a running Kuzzle environment, it is recommended to run these tests from a Kuzzle container.
Dans la première partie de phrase j'ai rajouté un verbe car la phrase était bancale pour la 2ème partie j'ai supprimé "within" car soit tu mets "from a Kuzzle container" soit "within a Kuzzle container". "From" et "within" sont deux préposition de lieu-->

From within a Docker container:
    $ docker exec -ti kuzzle_kuzzle_1 bash
    $ npm test
<!--From a Docker container:-->

Using a Vagrant virtual machine:

    $ vagrant ssh -c 'docker exec -ti kuzzle_kuzzle_1 bash'
    $ npm test

You may also run unit and functional tests separately, or with additional arguments.
For more information, check the [unit testing](test/README.md) and the [functional testing](features/README.md) documentation.


# Contributing to Kuzzle

See [contributing documentation](./CONTRIBUTING.md)


# Full documentation

See [full documentation](docs/README.md)


# Acknowledgement

Thanks to [Sails](https://github.com/balderdashy/sails) project for a good Node.js infrastructure example.

# License

Kuzzle is published under [Apache 2 License](LICENSE.md).
