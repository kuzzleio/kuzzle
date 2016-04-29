[![Build Status](https://travis-ci.org/kuzzleio/kuzzle.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle) [![codecov.io](http://codecov.io/github/kuzzleio/kuzzle/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/kuzzle?branch=master) [![Dependency Status](https://david-dm.org/kuzzleio/kuzzle.svg)](https://david-dm.org/kuzzleio/kuzzle)

[![Join the chat at https://gitter.im/kuzzleio/kuzzle](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/kuzzleio/kuzzle?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

<p align=center> ![logo](http://kuzzle.io/guide/images/kuzzle.svg)

# About Kuzzle

For UI and linked objects developers, Kuzzle is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc;).

Kuzzle features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols.

Kuzzle uses [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html) (see [filters syntax](http://kuzzle.io/guide/#filtering-syntax) for more details) as filtering language, and [Redis](http://redis.io/) to manage filters cache.

# Installation

## Using the all-in-one Docker recipe

If you are running Docker and just want to get your own Kuzzle running, you can use the provided docker-compose file.

Prerequisites:

* [Docker](https://docs.docker.com/installation/#installation) (version >1.5.0)
* [Docker Compose](https://docs.docker.com/compose/install/) (version >1.2.0)

From Kuzzle's root directory:

    $ docker-compose up

**Note:** Kuzzle need an access to the web to download plugins. If you are behind a proxy, you may use this [container](https://hub.docker.com/r/klabs/forgetproxy/) to configure docker accordingly.  
More information about plugins [here](http://kuzzle.io/guide/#plugins)

## Using Vagrant

If you are not running Docker on your system, you can pop a virtual machine to run Kuzzle.

Prerequisites:

* [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant](https://www.vagrantup.com/)

From the root directory:

    $ vagrant up

## Advanced installation

Take a look at the documentationfor more installation ways. (Manual installation, update, add fixture, database reset and more):
* [Linux](http://kuzzle.io/guide/#install-on-linux)
* [Windows](http://kuzzle.io/guide/#install-on-windows)

# Using Kuzzle

Your applications can now connect to Kuzzle. We provide a few ways to do this:

* Using one of our [SDK](http://kuzzle.io/sdk-documentation/) ([Javascript](https://github.com/kuzzleio/sdk-javascript), [Android](https://github.com/kuzzleio/sdk-android), more coming soon...).
* Directly, by accessing one of our [API](http://kuzzle.io/api-reference/) (REST, WebSocket, AMQP, MQTT or STOMP)

You can also play with our [demos](http://kuzzle.io/demos-tutorials/) for a quick Kuzzle overview.

# Running Tests

    $ npm test
Because functional tests need to be done in a running Kuzzle environment, it is recommended to run these tests from a Kuzzle container.

Using Compose:

```
    $ docker-compose -f docker-compose/test.yml up
```

This command will pop all the stack for running Kuzzle, then execute unit test and functional test. When all tests are done, containers are destroyed.

Using a Vagrant virtual machine:

    $ vagrant ssh -c 'cp -fR /vagrant /tmp/ && cd /tmp/vagrant && docker-compose -p kuzzle -f docker-compose/test.yml up'

You may also run unit and functional tests separately, or with additional arguments.
For more information, check the [unit testing](test/README.md) and the [functional testing](features/README.md) documentation.


# Contributing to Kuzzle

See [contributing documentation](./CONTRIBUTING.md)


# Full documentation

See [full documentation](http://kuzzle.io/guide/)


# Acknowledgement

Thanks to [Sails](https://github.com/balderdashy/sails) project for a good Node.js infrastructure example.


# License

Kuzzle is published under [Apache 2 License](LICENSE.md).
