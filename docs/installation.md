# Installation

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

Remember that the fixtures must be in the Docker container scope !

### Initialize Kuzzle mapping with Docker recipe

If you need to add a default mapping on Kuzzle start, from Kuzzle's root directory:

    $ DEFAULT_MAPPING=path/to/the/mapping/file.json docker-compose up

Remember that the default mapping must be in the Docker container scope !

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
