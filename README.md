# Kuzzle

For UI and linked objects developers, Kuzzle is an open-source solution that handles all the data managment
(CRUD, real-time storage, search, high-level features, etc;).
Kuzzle features are accessible through a secured API, with a large choice of protocols.

# What it does

Kuzzle allows applications to share real-time data, as well as store and search persistent data.
It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols (see [Specifications](src/docs/specifications.md) for details).

The filtering language is a subset of [Elasticsearch filter DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html).
(see [filters syntax](src/docs/filters.md) for more details).

# How to build & run

Kuzzle run within a set of docker containers.

* build containers :

    ```bash
    $ cd deployment && ./build-all.sh
    ```

* run containers :

    ```bash
    $ docker-compose up [-d]
    ```

* run containers with debugger (dev only)

    ```bash
    $ docker-compose -f docker-compose-debug.yml up [-d]
    ```
    
If you need custom parameters like Elasticsearch on other host, you can copy docker-compose.yml into docker-compose-custom.yml and change setting like environment variables. Next, you can run

```bash
$ docker-compose -f docker-compose-custom.yml up [-d]
```

# Documentation

See [main readme](src/README.md) and [Detailed documentation](src/docs/index.md)