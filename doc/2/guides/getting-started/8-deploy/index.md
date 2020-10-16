---
code: false
type: page
title: Deploy
description: Deploy your application on a remote server
order: 800
---

# Deploy

Kuzzle is just a Node.js application that also needs Elasticsearch and Redis to run.  

Thus, there is an infinite way of deploying a Kuzzle application.  

At Kuzzle we like to use Docker and Docker Compose to quickly deploy applications.  
In this guide we will see how to deploy a Kuzzle application on a remote server.

**Prerequisites:**
  - A SSH access to a remote server running on Linux
  - [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on this server

::: info
In this guide we will perform a basic deployment of a Kuzzle application.  
For critical production deployments, we strongly recommend to deploy your application in [cluster](/core/2/guides/some-link) mode to take advantage of high availability and scalability.  
Our team can bring its expertise and support for such deployments: [get a quote](https://info.kuzzle.io/contact-us)
:::

## Target architecture

We will deploy the following services in Docker containers:
 - Node.js (Kuzzle)
 - Elasticsearch
 - Redis

We will use Docker Compose as a basic container orchestrator.

Only Kuzzle will be exposed to the internet on the port 7512.

![Kuzzle basic single node deployment](./deploy-kuzzle-single-node.png)

::: warning
This deployment does not use any SSL encryption (HTTPS).  
A production deployment must include a reverse proxy like Nginx to [securize the connection with SSL](/core/2/guides/ssl).  
:::

## Prepare our Docker Compose deployment

We are going to write a `docker-compose.yml` file that describe our services.  

First, create a `deploy/` directory: `mkdir deploy/`

Then create the `deploy/docker-compose.yml` file and paste the following content:

```yaml
---
version: "3"

services:
  kuzzle:
    image: kuzzleio/kuzzle:2
    restart: always 
    container_name: kuzzle
    ports:
      - "7512:7512"
      - "1883:1883"
    depends_on:
      - redis
      - elasticsearch
    environment:
      - kuzzle_services__storageEngine__client__node=http://elasticsearch:9200
      - kuzzle_services__internalCache__node__host=redis
      - kuzzle_services__memoryStorage__node__host=redis
      - NODE_ENV=production

  redis:
    image: redis:5
    restart: always
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  elasticsearch:
    image: kuzzleio/elasticsearch:7
    restart: always
    ulimits:
      nofile: 65536
    volumes:
      - es-data:/usr/share/elasticsearch/data

volumes:
  es-data:
    driver: local
  redis-data:
    driver: local
```