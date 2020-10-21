---
code: false
type: page
title: Deploy your application
description: Deploy your Kuzzle application on a remote server
order: 800
---

# Deploy

Kuzzle is just a Node.js application that also needs [Elasticsearch](https://www.elastic.co/what-is/elasticsearch) and [Redis](https://redis.io/topics/introduction) to run.  

The only specifity is that **Kuzzle needs to compile C and C++ dependencies** so the `npm install` will also be looking for `python`, `make` and `g++` packages.   

At Kuzzle we like to use Docker and Docker Compose to quickly deploy applications.  
In this guide we will see how to deploy a Kuzzle application on a remote server.

**Prerequisites:**
  - A SSH access to a remote server running on Linux
  - [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on this server
  - A Kuzzle application

::: info
In this guide we will perform a basic deployment of a Kuzzle application.  
For production deployments, we strongly recommend to deploy your application in [cluster mode](/core/2/guides/some-link) to take advantage of high availability and scalability.  
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

We are going to write a `docker-compose.yml` file that describes our services.  

First, create a `deployment/` directory: `mkdir deployment/`

Then create the `deployment/docker-compose.yml` file and paste the following content:

```yaml
---
version: "3"

services:
  kuzzle:
    build:
      context: ../
      dockerfile: deployment/kuzzle.dockerfile
    command: node /var/app/app.js
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
    command: redis-server --appendonly yes
    restart: always
    volumes:
      - redis-data:/data

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

This configuration allows to run a Kuzzle application with Node.js alongside Elasticsearch and Redis.

Kuzzle needs compiled dependencies for the cluster and the realtime engine.  

We are going to use a [multi-stage Dockerfile](https://docs.docker.com/develop/develop-images/multistage-build/) to build the dependencies and then use the [node:12-stretch-slim](https://hub.docker.com/_/node?tab=description) image to run the application.

Create the `deployment/kuzzle.dockerfile` file with the following content:

```dockerfile
# builder image
FROM node:12-stretch-slim as builder

RUN  set -x \
  && apt-get update && apt-get install -y \
       curl \
       g++ \
       make \
       python \
       libzmq3-dev

ADD . /var/app

WORKDIR /var/app

RUN  npm install --production

# run image
FROM node:12-stretch-slim

COPY --from=builder /var/app /var/app
```

## Deploy on your remote server

Now we are going to use `scp` (SSH copy) to copy our application on the remote server.  

```bash
$ scp -r ../playground <user>@<server-ip>:.
```

Then simply connect to your server and run your application with Docker Compose:

```bash
$ ssh <user>@<server-ip>

[...]

$ docker-compose -f deployment/docker-compose.yml up -d
```

Your Kuzzle application is now up and running on port 7512!

Learn more about:
 - [Deployment](/core/2/api/some-links)
 - [Setup Kuzzle with SSL](/core/2/some-link)
