---
code: false
type: page
order: 50
title: Migrate project from v7 to v8 | Develop on Kuzzle | Guide | Core
meta:
  - name: description
    content: Extend Kuzzle API with controllers and actions
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, iot, backend, opensource,  API Controllers
---

# Migrate a project from Elasticsearch 7 to Elasticsearch 8

<SinceBadge version="2.32.0"/>

Kuzzle relies on Elasticsearch as a [NoSQL document store](/core/2/guides/main-concepts/data-storage).

The support of Elasticsearch 8 has been introduced in Kuzzle 2.30.0.

To avoid any breaking changes around the support of Elasticsearch 8, we kept Kuzzle working seemlessly with Elasticsearch 7 and Elasticsearch 8.

The use of Elasticsearch 8 is an **opt-in** option, so no modification is needed on your behalf if you want to keep using Elasticsearch 7.

The default major version of Elasticsearch will be 7 until the next major version of Kuzzle that would ne Kuzzle v3.

## How to setup your project to use Elasticsearch 8

### Setup Kuzzle to use Elasticsearch 8 

#### Upgrade the npm package
First you need to upgrade you Kuzzle package to version `>= 2.30.0-es8` in the `package.json` file. Then run `npm install` to upgrade the packages for you application.

### Configure Kuzzle 
A new configuration key `majorVersion` has been introduced ine the `storageEngine` section to allow the selection of the Eleasticsearch version you want to support for your project.

When not specified, it will be considered to be version 7, specify 8 if you want to switch Kuzzle to support Elasticasearch 8.

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
You can not set the `majorVersion` key to 8 if you are using a version of Kuzzle that does not support it. (older versions of Kuzzle won't complain about this value)
:::

:::info
Kuzzle cannot connect to both Elasticsearch 7 and Elasticsearch 8 at the same time.  
:::

Once the version is set to 8, Kuzzle will use the Elasticsearch 8 API to communicate with the database.

### Launch Elasticsearch 8 (dev environnement)

Next you will have to change the docker-compose.yml file so that it pulls Elasticsearch 8 image with the recommanded configuration to work with Kuzzle

You can replace the original `elasticsearch` section with the following exemple

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

### Data migration

In the context of running the project in a development envinronnement, you can run your usual initialisation scripts as usual, or use Kourou to dump data from the project still running on Elasticsearch 7 and import them when you are done with setuping the project to run with Elasticsearch 8.

In the context of an hosted environment such as pre-prodcution or production environnement, we recommand following this guide.
