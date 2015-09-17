[![Build Status](https://travis-ci.org/kuzzleio/kuzzle.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle) [![codecov.io](http://codecov.io/github/kuzzleio/kuzzle/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/kuzzle?branch=master) [![Dependency Status](https://david-dm.org/kuzzleio/kuzzle.svg)](https://david-dm.org/kuzzleio/kuzzle)

<p align=center> ![logo](docs/images/logo.png)

# About Kuzzle

[![Join the chat at https://gitter.im/kuzzleio/kuzzle](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/kuzzleio/kuzzle?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

For UI and linked objects developers, Kuzzle is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc;).

Kuzzle features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols.

Kuzzle uses [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html) (see [filters syntax](docs/filters.md) for more details) as filtering language, [RabbitMQ](https://www.rabbitmq.com/) to manage queues and [Redis](http://redis.io/) to manage filters cache.

# Project status

Kuzzle is currently in Alpha stage of development.

We have a pretty clear idea of what we want to implement to bring Kuzzle to a Beta version.  
Check our [roadmap](./ROADMAP.md) if you wish to know more about it.

# Installation

## Using the all-in-one Docker recipe

If you are running Docker and just want to get your own Kuzzle running, you can use the provided docker-compose file.

Prerequisites:

* [Docker](https://docs.docker.com/installation/#installation) (version >1.5.0)
* [Docker Compose](https://docs.docker.com/compose/install/) (version >1.2.0)

From Kuzzle's root directory:

    $ docker-compose up

## Using Vagrant

If you are not running Docker on your system, for instance if you are running Windows or MacOs, you can pop a virtual machine to run Kuzzle.

Prerequisites:

* [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant](https://www.vagrantup.com/)

From the root directory:

    $ vagrant up

## Advanced installation

Take a look at the [installation](docs/installation.md) file for more installation ways. (Manual installation, add fixture, database reset and more)

# Using Kuzzle

Your applications can now connect to Kuzzle. We provide a few ways to do this:

* Using one of our SDK ([Javascript](https://github.com/kuzzleio/sdk-javascript), more coming soon)
* Directly, by accessing one of our API ([REST](docs/API.REST.md), [WebSocket](docs/API.WebSocket.md), [AMQP](docs/API.AMQP.md), [MQTT](docs/API.MQTT.md) or [STOMP](docs/API.STOMP.md))

You can also play with [demos](https://github.com/kuzzleio/demo) for a quick Kuzzle overview.

# Running Tests

    $ npm test
Because functional tests need to be done in a running Kuzzle environment, it is recommended to run these tests from a Kuzzle container.

From a Docker container:

```
    $ docker exec -ti kuzzle_kuzzle_1 bash
    $ npm test
```

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
