# Installation

## Table of Contents

* [Using the all-in-one Docker recipe](#using-the-all-in-one-docker-recipe)
  * [Reset Kuzzle with Docker recipe](#reset-kuzzle-with-docker-recipe)
  * [Reset Kuzzle and insert sorme fixtures with Docker recipe](#reset-kuzzle-and-insert-sorme-fixtures-with-docker-recipe)
  * [Initialize Kuzzle mapping with Docker recipe](#initialize-kuzzle-mapping-with-docker-recipe)
  * [Useful tips](#useful-tips)
    * [Updating kuzzle's containers](#updating-kuzzles-containers)
    * [Updating kuzzle's dependencies](#updating-kuzzles-dependencies)
* [Using Vagrant](#using-vagrant)
* [From source or NPM](#from-source-or-npm)
* [Manual install](#manual-install)
  * [Default](#default)
  * [Change external services hosts](#change-external-services-hosts)

## Using the all-in-one Docker recipe

If you are running Docker and just want to get your own Kuzzle running, you can use the provided docker-compose file.

Prerequisites:

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

    $ DEFAULT_MAPPING=path/to/the/mapping/file.json docker-compose up

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


### Change external services hosts

If you are running some of the service(s) externally, you can configure their host and port using some environment variables:

examples:

```bash
# Elastic Search (read/write engine):
$ export READ_ENGINE_HOST=myelasticsearch:9200
$ export WRITE_ENGINE_HOST=myelasticsearch:9200

# Redis (cache services):
$ export CACHE_HOST=myredis
$ export CACHE_PORT=6379

# Rabbit MQ (external broker for AMQP/MQTT/STOMP clients):
$ export MQ_BROKER_HOST=myrabbitmq
$ export MQ_BROKER_PORT=5672

$ kuzzle start
```
