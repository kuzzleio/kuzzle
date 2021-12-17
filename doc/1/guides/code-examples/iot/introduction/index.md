---
code: false
type: page
title: Introduction
order: 0
description: IoT Code Examples
---

## Code Example: Real-Time Pub/Sub

Kuzzle comes equipped with a multi-protocol API that can be used to communicate with IoT devices.

In this code example we will show you how to connect to Kuzzle using MQTT, a widely adopted communication protocol in IoT ecosystems.

## Install Kuzzle and enable the MQTT protocol

First, you need to download Kuzzle.
To do that you can follow these [instructions](/core/1/guides/getting-started#running-kuzzle).

In order to enable the MQTT protocol in Kuzzle, we just need to add 3 lines in the docker-compose file. Specifically, we need to open the port `1883`, which is the default for MQTT, and we need to set 2 environment variables.

Now, edit the `docker-compose.yml` file and make the following modifications:

- In the `ports` section:

```
- "1883:1883"
```

- In the environment section, enable the mqtt protocol and disable development mode:

```yaml
- kuzzle_server__protocols__mqtt__enabled=true
- kuzzle_server__protocols__mqtt__developmentMode=false
```

The full code should look like this:

```yaml
version: '3'

services:
  kuzzle:
    image: kuzzleio/kuzzle
    ports:
      - "7512:7512"
      - "1883:1883"
    cap_add:
      - SYS_PTRACE
    depends_on:
      - redis
      - elasticsearch
    environment:
      - kuzzle_services__db__client__host=http://elasticsearch:9200
      - kuzzle_services__internalCache__node__host=redis
      - kuzzle_services__memoryStorage__node__host=redis
      - kuzzle_server__protocols__mqtt__enabled=true
      - kuzzle_server__protocols__mqtt__developmentMode=false
      - NODE_ENV=production

  redis:
    image: redis:5

  elasticsearch:
    image: kuzzleio/elasticsearch:5
    ulimits:
      nofile: 65536
    environment:
      - cluster.name=kuzzle
      - "ES_JAVA_OPTS=-Xms1024m -Xmx1024m"

```

Now we can run the stack using the following command (from the same folder as your docker-compose.yml):

```bash
docker-compose up -d
```

This might take a few minutes. When the dependencies finished installing, restart the Kuzzle container:

```bash
docker-compose restart kuzzle
```

Now your MQTT protocol should be up and running!

## Create Your App

Now that we have our Kuzzle configured, we can start programming our App. Here is an outline of what the App will do:

1. _Connect to Kuzzle_
2. _Subscribe to the MQTT Response Topic_ to receive responses from the Kuzzle
3. _Publish a request on the MQTT Request Topic_ to send API requests to Kuzzle

Before we get started on the App, there are a few basics you need to know:

- Firstly, a subscription is done at the collection level. This means that Kuzzle will only monitor changes to documents in the specified collection.

- Secondly, we are using the MQTT Protocol as a transport layer to access the Kuzzle API. This means that the full Kuzzle API is available through this transport, but that the mechanism for handling requests and responses differs from that of the websocket transport. This is most obvious for the Publish/Subscribe methods of the Kuzzle API. We need to distinguish between the subscription to the "Kuzzle/Response" MQTT topic, used only to communicate with the Kuzzle API, and a subscription to a Kuzzle Collection, used for pub/sub in the context of an application. To create a subscription to a Kuzzle Collection via the MQTT protocol, first we must publish a request to Kuzzle on the "Request" topic with action set to "subscribe", then we will receive a response on the "Kuzzle/response" MQTT topic that contains the name of the MQTT topic that we need to subscribe to. Once the response is received on the "Kuzzle/response" MQTT topic, we can then subscribe to the MQTT topic specified is response's topic field to listen for messages.
