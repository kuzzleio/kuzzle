---
code: false
type: page
order: 50
title: Elasticsearch 8 | Develop on Kuzzle | Guide | Core
meta:
  - name: description
    content: Extend Kuzzle API with controllers and actions
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, iot, backend, opensource,  API Controllers
---

# Migrate Elasticsearch 8

<SinceBadge version="2.30.0"/>

Kuzzle relies on Elasticsearch as a [NoSQL document store](/core/2/guides/main-concepts/data-storage).

The support of Elasticsearch 8 has been introduced in Kuzzle 2.30.0.

To avoid any breaking changes around the support of Elasticsearch 8, we kept Kuzzle working seemlessly with Elasticsearch 7 and Elasticsearch 8.

The use of Elasticsearch 8 is an **opt-in** option, so no modification is needed on your behalf if you want to keep using Elasticsearch 7.

The default major version of Elasticsearch will be 7 until the next major version of Kuzzle that would ne Kuzzle v3.

# How to setup your project to use Elasticsearch 8

The new configuration key has been introduce to select the Eleasticsearch version you want to support for your project.
When not specified, it we be considered as version 7.
Specify 8 if you want to switch Kuzzle to support Elasticasearch 8.

This has to be add to you kuzzlerc file, or provided via an environnement variable (see RC doc for details on kuzzlerc configation options)

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
You can not set the `majorVersion` key to 8 if you are using a version of Kuzzle that does not support it. 
:::

:::info
Kuzzle cannot connect to both Elasticsearch 7 and Elasticsearch 8 at the same time.  
:::

Once the version is set to 8, Kuzzle will use the Elasticsearch 8 API to communicate with the database.

Next you will have to change the docker-compose.yml file so that it pulls Elasticsearch 8 image with the recommanded confiuration to work with Kuzzle:

```yaml
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

## Migrating to V8

Migration Guide from Elasticsearch 7.x to Elasticsearch 8.x

### Prerequisites

Before starting the migration process, ensure the following:
* __Backup your data__: Always backup your indices and cluster settings before starting the migration. Use the Snapshot and Restore feature for this.
* __Version Check__: Make sure your Elasticsearch 7.x is at the latest minor version. Elasticsearch supports migrating from the last minor version of the previous major version.

### Check Deprecation API

* Elasticsearch Deprecation API can be used to check for any features or settings in your current cluster that are deprecated or removed in the 8.x version. Address these issues before proceeding.
* Test in a Non-Production Environment
Conduct a dry run in a development environment to spot potential issues and estimate the duration the migration process might take.

### Migration Methods

1. Re-indexing
	* Step 1: Create a new cluster running Elasticsearch 8.x.
	* Step 2: Take a snapshot of your data in the current 7.x cluster.
	* Step 3: Restore the snapshot into the new 8.x cluster.
1. Rolling Upgrade
	* Step 1: Disable Shard Allocation.
	* Step 2: Stop and upgrade a single Elasticsearch node.
	* Step 3: Enable Shard Allocation and allow the node to join the cluster and the cluster to re-balance.
	* Step 4: Repeat for each node in the cluster.
1. Post Upgrade Checks
	* Run the health and stats APIs to ensure the health of your newly upgraded cluster.
	* Update your clients and integrations to the latest version that's compatible with Elasticsearch 8.x, if not done already.
	* Monitor your cluster using the Monitoring API or third-party monitoring services.
1. Troubleshoot
  * If you encounter any issues during the migration process, take advantage of the Elasticsearch documentation, forums, and issue trackers for troubleshooting information and support.

> Note: Migration steps can vary depending on your setup and needs. Always refer to the official Elasticsearch documentation for the most accurate information, you can find it [here](https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-upgrade.html).

Disclaimer: The above steps provide a general migration guide. Migrations can be complex and it's advised to always test these steps in a non-production environment before applying them to production.
