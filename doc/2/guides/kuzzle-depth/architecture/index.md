---
code: false
type: page
title: Architecture
---

# Architecture

In this section we'll take a closer look at Kuzzle's server architecture.

![archi_core](./Kuzzle_Server_Architecture.png)

## Core Components

The diagram above depicts the various components that make up the server architecture, these are:

- **Entry Points**: handles the incoming message and sends them to the _Funnel_.
- **Router**: exposes the HTTP endpoints, normalizes any request, and forwards it to the _Funnel_.
- **Funnel**: receives normalized requests and forwards it to the appropriate controller, sends results back to the _Entry Points_.
- **Controllers**: receives data fom the _Funnel_, processes it, and returns a result to the _Funnel_ (see [API reference](/core/2/api)).
- **Internal Components**: are internal modules used by controllers to process a request.
- **Service Components**: are interfaces used by controllers to connect to external services (see [below](/core/2/guides/kuzzle-depth#services)).

## Services

In our architecture, a "Service" is an interface that interacts with external components.

Kuzzle currently implements the following Services:

- [elasticsearch.js](https://github.com/kuzzleio/kuzzle/blob/master/lib/service/storage/elasticsearch.js): interface to [Elasticsearch](https://www.elastic.co/elastic-stack), used for persistent data storage.
- [redis.js](https://github.com/kuzzleio/kuzzle/blob/master/lib/service/cache/redis.js): interface to the [redis](http://redis.io), used as a cache.
