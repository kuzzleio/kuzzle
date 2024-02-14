---
code: false
type: page
order: 100
title: Elasticsearch 8 | Develop on Kuzzle | Guide | Core
meta:
  - name: description
    content: Extend Kuzzle API with controllers and actions
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, iot, backend, opensource,  API Controllers
---

# Elasticsearch 8

<SinceBadge version="2.30.0"/>

Kuzzle uses Elasticsearch as a [NoSQL document store](/core/2/guides/main-concepts/data-storage).

With Kuzzle, customers **can directly access data stored in the database** as long as they have the rights to do so.

Kuzzle exposes the [Elasticsearch Query Language](/core/2/guides/main-concepts/querying) in a secure way. It is therefore possible to **take full advantage of the possibilities of Elasticsearch** with boolean queries, aggregations, special fields, etc.

The support of Elasticsearch 8 has been introduced in Kuzzle 2.30.0.

The choice has been made to keep kuzzle compatible to avoid breaking changes around the support of ES8.

We wanted to allow the user to OPT-IN for the feature so no modification is needed on your behalf to stay with Elasticsearch 7.

By default the majorVersion support will be 7 until Kuzzle v3.

The new key to change the version supported by is available under

```json
{
  "services": {
    "storageEngine": {
      "majorVersion": 8
    }
  }
}
```

:::warning
You can not set the majorVersion to 8 if you are using a version of Kuzzle that does not support it.
:::

:::info
Kuzzle cannot connect to both ES7 and ES8 at the same time.
:::

Once the version is set to 8, Kuzzle will use the Elasticsearch 8 API to communicate with the database.

You will find below an example of a `docker-compose.yml` file to run Kuzzle with Elasticsearch 8.

```yaml
version: '3.8'

services:
  node:
    image: kuzzleio/kuzzle:2
    depends_on:
      redis:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
    ports:
      - "7512:7512"
      - "7511:7511"
      - "7510:7510"
      - "9229:9229"
      - "1883:1883"
    environment:
      - kuzzle_services__storageEngine__client__node=http://elasticsearch:9200
      - kuzzle_services__storageEngine__commonMapping__dynamic=true
      - kuzzle_services__internalCache__node__host=redis
      - kuzzle_services__memoryStorage__node__host=redis
      - NODE_ENV=${NODE_ENV:-development}
      - DEBUG=${DEBUG:-none}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7512/_healthcheck"]
      timeout: 10s
      interval: 10s
      retries: 30
      start_period: 1m

  redis:
    image: redis:6
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 1s
      timeout: 3s
      retries: 30

  elasticsearch:
    image: elasticsearch:8.11.3
    container_name: kuzzle_elasticsearch
    environment:
      - xpack.security.enabled=false
      - action.destructive_requires_name=false
      - cluster.name=kuzzle
      - node.name=alyx
      - discovery.type=single-node
      - ingest.geoip.downloader.enabled=false
      - indices.id_field_data.enabled=true
    ports:
      - '9200:9200'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9200']
      interval: 2s
      timeout: 2s
      retries: 10
    ulimits:
      nofile: 65536
```

Or you can run `kourou app:scaffold sandbox` to create a new Kuzzle project with a `docker-compose.yml` file that uses Elasticsearch 8.