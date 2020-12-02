---
code: false
type: page
title: MQTT
description: MQTT protocol usage and configuration  
order: 300
---

# MQTT

MQTT is a lightweight messaging protocol designed for IoT devices and optimized for **high-latency** or **unreliable networks**.  

It establishes a **bidirectional communication channel** between a client and a server.

::: warning
The MQTT protocol is disabled by default.
:::

## Configuration

The protocol can be configured via the [kuzzlerc configuration file](/core/2/guides/advanced/8-configuration), under the `server > protocols > mqtt` section.

```js
  "server": {
    "protocols": {
      "mqtt": {
        // Set to true to enable MQTT support
        "enabled": false,

        // Allow MQTT pub/sub capabilities or restrict to Kuzzle requests only
        "allowPubSub": false,
        
        // Switches responseTopic back to a regular public topic
        "developmentMode": false,

        // Delay in ms to apply between a disconnection notification is
        // received and the connection is actually removed
        "disconnectDelay": 250,

        // Name of the topic listened by the plugin for requests
        "requestTopic": "Kuzzle/request",

        // Name of the topic clients should listen to get requests result
        "responseTopic": "Kuzzle/response",

        // Constructor options passed to underlying mqtt server.
        // See aedes documentation for further reference: https://github.com/moscajs/aedes
        "server": {
          "port": 1883
        }
      }
```

## Usage

### Sending an API request and getting the response

By default, the MQTT protocol listens to the `Kuzzle/request` MQTT topic (see [configuration](#configuration)) for requests to the [Kuzzle API](/core/2/api/essentials/connecting-to-kuzzle).

It then forwards Kuzzle responses to the `Kuzzle/response` MQTT topic, **and only to the client who made the initial request**.

The order of responses is not guaranteed to be the same as the order of the requests. To link a response to its original request, use the `requestId` attribute: the response will have the same `requestId` than the one provided in the request.

Example using [MQTT Node module](https://www.npmjs.com/package/mqtt): _to use a CLI client, you will need to enable development mode. Please refer to [the dedicated section below](#development-mode) for instruction and examples_

```js
const mqtt = require('mqtt'),
  client = mqtt.connect({ host: 'localhost' });

// Sending a volatile message
client.publish(
  'Kuzzle/request',
  JSON.stringify({
    index: 'index',
    collection: 'collection',
    controller: 'realtime',
    action: 'publish',
    requestId: 'some unique ID',
    body: { some: 'message' }
  })
);

// Getting Kuzzle's response
client.on('message', (topic, raw) => {
  const message = JSON.parse(Buffer.from(raw));

  // API results topic
  if (topic === 'Kuzzle/response') {
    // Response to our "publish" request
    if (message.requestId === 'some unique ID') {
      console.log('Message publication result: ', message);
    }
  }
});
```

### Using Kuzzle subscriptions

Kuzzle allows to [subscribe](/core/2/api/controllers/realtime/subscribe) to messages and events using advanced filters.

Each time a subscription is sent, a dedicated MQTT topic is created, named after the `channel` property issued by Kuzzle.

Here are the steps to perform a Kuzzle subscription using MQTT:

- Send a subscription request to Kuzzle
- Listen to the request's response to get the `channel` identifier
- Subscribe to the MQTT topic named after this channel identifier

Example using [MQTT Node module](https://www.npmjs.com/package/mqtt):

```js
const mqtt = require('mqtt');

const client = mqtt.connect({ host: 'localhost' });
const channels = [];

// Sending a volatile message
client.publish(
  'Kuzzle/request',
  JSON.stringify({
    index: 'index',
    collection: 'collection',
    controller: 'realtime',
    action: 'subscribe',
    requestId: 'some unique ID',
    body: {
      term: {
        some: 'filter'
      }
    }
  })
);

// Getting Kuzzle's response
client.on('message', (topic, raw) => {
  const message = JSON.parse(Buffer.from(raw));

  // API results topic
  if (topic === 'Kuzzle/response') {
    // Response to our "publish" request
    if (message.requestId === 'some unique ID') {
      channels.push(message.result.channel);
      client.subscribe(message.result.channel);
    }
  } else if (channels.indexOf(topic) !== -1) {
    // Subscription notification
    console.log('Notification: ', message);
  }
});
```

## Authorizations

### Publishing

If `allowPubSub` is set to `false`, clients can only publish to the `requestTopic` topic (defaults to `Kuzzle/request`).

If `allowPubSub` is set to `true`, clients are only forbidden to publish to the `responseTopic` topic (defaults to `Kuzzle/response`).

:::warning
Wildcard subcriptions are not allowed
:::

If a client tries to publish to an unauthorized topic, their connection will immediately be shut down by the server.

### Subscribing

Subscription attempts to the `requestTopic` topic (defaults to `Kuzzle/request`) are ignored: client requests can only be listened by the MQTT server.

## Development mode

The MQTT `Kuzzle/response` topic is by default a special topic that acts as a private channel. Each client receives its own responses only, offering a simple first security layer.

While this behavior is highly recommended in production, it can bring a small drawback when testing and developing applications: it does not allow using most CLI tools.
Many CLI tools, such as Mosquitto offer two separate binaries, one for subscribing and one for publishing. These act as two different clients and the subscriber won't receive any response sent to the publisher by default.

To use these tools, one can enable the **development mode**, in which `Kuzzle/response` will act as a regular public topic.

:::warning
Do not use development mode in production!
:::

To enable development mode, you will need to **both** set `NODE_ENV` environment variable to `development` and set the MQTT protocol `developmentMode` to `true`:

```bash
# Enable MQTT development mode
export NODE_ENV=development
export kuzzle_server__protocols__mqtt__enabled=true
export kuzzle_server__protocols__mqtt__developmentMode=true

node app.js
```

```bash
# client 1
$ mosquitto_sub -t Kuzzle/response

# client 2
$ mosquitto_pub -t Kuzzle/request -m '{"controller": "server", "action": "now"}'

# client 1
$ {"requestId":"83a63209-7633-4884-9f1a-c490ce446ddf","status":200,"error":null,"controller":"server","action":"now","collection":null,"index":null,"volatile":null,"result":{"now":1509967201489}}
```
