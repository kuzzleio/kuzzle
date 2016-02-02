# Installation

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Using the all-in-one Docker recipe](#using-the-all-in-one-docker-recipe)
  - [Prerequisites](#prerequisites)
  - [Reset Kuzzle with Docker recipe](#reset-kuzzle-with-docker-recipe)
  - [Reset Kuzzle and insert sorme fixtures with Docker recipe](#reset-kuzzle-and-insert-sorme-fixtures-with-docker-recipe)
  - [Initialize Kuzzle mapping with Docker recipe](#initialize-kuzzle-mapping-with-docker-recipe)
  - [Useful tips](#useful-tips)
    - [Updating kuzzle's containers](#updating-kuzzles-containers)
    - [Updating kuzzle's dependencies](#updating-kuzzles-dependencies)
- [Using Vagrant](#using-vagrant)
- [Manual install](#manual-install)
  - [Prerequisites](#prerequisites-1)
  - [Step one](#step-one)
  - [Step two](#step-two)
  - [Step three](#step-three)
  - [Finally](#finally)
  - [All steps in one](#all-steps-in-one)
  - [Going further](#going-further)
    - [Command Line Interface](#command-line-interface)
    - [Change external services hosts or ports](#change-external-services-hosts-or-ports)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Using the all-in-one Docker recipe

If you are running Docker and just want to get your own Kuzzle running, you can use the provided docker-compose file.

### Prerequisites

* [Docker](https://docs.docker.com/installation/#installation)
* [Docker Compose](https://docs.docker.com/compose/install/)

From Kuzzle's root directory:

    $ docker-compose up

### Reset Kuzzle with Docker recipe

If you need to get a fresh start with all persistent data erased, from Kuzzle's root directory:

    $ LIKE_A_VIRGIN=1 docker-compose up

### Reset Kuzzle and insert sorme fixtures with Docker recipe

If you need to get a fresh start with all persistent data erased and populate it with default fixtures, from Kuzzle's root directory:

    $ FIXTURES=path/to/the/fixtures/file.json docker-compose up
    
examples:

```javascript
{
  "index": {
    "collection": [
      { "index": {} },
      { "a": "document", "with": "any", "number": "of fields" },
      { "index": {} },
      { "another": "document" },
      { "index": {} },
      { "and": { another: "one"} },
    ],
    "otherCollection": [
      { "index": {} },
      { "foo": "bar", "baz": {"bar": "foo"}, "done": true },
    ]
  },
  "otherindex": {
    "collection": [
      { "index": {} },
      { "...": "..." }
    ]
  }
}
```


Remember that the fixtures must be in the Docker container scope !

### Initialize Kuzzle mapping with Docker recipe

If you need to add a default mapping on Kuzzle start, from Kuzzle's root directory:

    $ FIXTURES=path/to/the/fixtures/file.json DEFAULT_MAPPING=path/to/the/mapping/file.json docker-compose up

examples:

```javascript
{
  "index": {
    "collection": [
      {
        "properties" : {
          "position" : {"type" : "geo_point" }
        }
      }
    ]
  }
}
```

Remember that the default mapping must be in the Docker container scope !

You can, of course, use all those option alltogether like:

    $ LIKE_A_VIRGIN=1 FIXTURES=fixtures/file.json DEFAULT_MAPPING=mapping/file.json docker-compose up

### Useful tips


#### Updating kuzzle's containers

When you already have installed an old version of kuzzle, don't forget to update kuzzle's containers with:

```
    $ docker-compose -f <docker-compose-file.yml> pull 
```

#### Updating kuzzle's dependencies 

To ensure that Kuzzle's dependencies are up-to-date, run the command directly without log-in into the container:

```
    $ docker exec -ti <docker-compose-file.yml> run kuzzle npm install
    $ docker exec -ti <docker-compose-file.yml> run kuzzle bin/kuzzle.js install
```


## Using Vagrant

If you are not running Docker on your system, for instance if you are running Windows or MacOs, you can pop a virtual machine to run Kuzzle.

Prerequisites:

* [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant](https://www.vagrantup.com/)

From the root directory:

    $ vagrant up

## Manual install

**Note:** we will assume that you want to launch Kuzzle and other services on the same host (localhost), but you can, of course, host kuzzle and any of its services on different hosts.

### Prerequisites

* A service [Elasticsearch](https://www.elastic.co/products/elasticsearch) running on localhost:9200
* A service [Redis](http://redis.io/) running on localhost:6379
* A properly installed [nodeJs](https://nodejs.org/en/download/package-manager/) **version 4** or upper

### Step one

Retrieve the Kuzzle source code from the [GitHub repo](https://github.com/kuzzleio/kuzzle.git) by doing

    $ git clone https://github.com/kuzzleio/kuzzle.git
    $ cd kuzzle

then install the dependencies by doing:

    $ npm install

### Step two

Configure your environment. Kuzzle has been designed to be launched into a container, so the default hosts used to access to the ElasticSearch and Redis servers needs to be tweaked to hit the right hosts. If everything is hosted on localhost, you can use environment variable to overwrite default ones:

    $ export READ_ENGINE_HOST=localhost:9200
    $ export WRITE_ENGINE_HOST=localhost:9200
    $ export CACHE_HOST=localhost
    $ export CACHE_PORT=6379


### Step three

Install the default plugins, by doing:

    $ ./bin/kuzzle.js install


### Finally

Start Kuzzle with default options (one server and one worker) by doing

    $ ./bin/kuzzle.js start

### All steps in one

    $ git clone https://github.com/kuzzleio/kuzzle.git
    $ cd kuzzle
    $ npm install
    $ export READ_ENGINE_HOST=localhost:9200
    $ export WRITE_ENGINE_HOST=localhost:9200
    $ export CACHE_HOST=localhost
    $ export CACHE_PORT=6379
    $ ./bin/kuzzle.js install
    $ ./bin/kuzzle.js start

### Going further

#### Command Line Interface

Kuzzle comes along with a [CLI](https://en.wikipedia.org/wiki/Command-line_interface)

To get a list of available options, you can run

    $ ./bin/kuzzle.js start -h

#### Change external services hosts or ports

If you are running some of the service(s) externally, you can configure their host and port using some environment variables:

examples:

    # Elastic Search (read/write engine):
    $ export READ_ENGINE_HOST=myelasticsearch:9200
    $ export WRITE_ENGINE_HOST=myelasticsearch:9200

    # Redis (cache services):
    $ export CACHE_HOST=myredis
    $ export CACHE_PORT=6379

    # Rabbit MQ (external broker for AMQP/MQTT/STOMP clients):
    $ export MQ_BROKER_HOST=myrabbitmq
    $ export MQ_BROKER_PORT=5672

    $ ./bin/kuzzle.js start
