[![Build Status](https://travis-ci.org/kuzzleio/protocol-mqtt.svg?branch=master)](https://travis-ci.org/kuzzleio/protocol-mqtt) [![codecov.io](http://codecov.io/github/kuzzleio/protocol-mqtt/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/protocol-mqtt?branch=master) [![Dependency Status](https://david-dm.org/kuzzleio/protocol-mqtt.svg)](https://david-dm.org/kuzzleio/protocol-mqtt)


MQTT protocol for [Kuzzle](https://github.com/kuzzleio/kuzzle).

# Installation

Clone this repository into kuzzle's `protocols/enabled` directory and run `npm install`:

```
mkdir -p <kuzzle path>/protocols/available
mkdir -p <kuzzle path>/protocols/enabled

git clone https://github.com/kuzzleio/protocol-mqtt.git <kuzzle path>/protocols/available/mqtt
ln -s <kuzzle path>/protocols/available/mqtt <kuzzle path>/protocols/enabled

cd <kuzzle path>/protocols/enabled/mqtt
npm install # Add --unsafe-perm if installing from inside a docker container
```

**Note:** Do not mind compilation errors, they are from an optional dependency in one of the communication module this protocol uses. If these errors bother you and you do want to get rid of them, simply follow the [zmq node module installation process](https://www.npmjs.com/package/zmq#installation).

# Configuration

This protocol can be configured via Kuzzle'rc configuration, under `server > protocols > mqtt` section.

| property | default | type | description
|---|---|---|---
| ``allowPubSub`` | `false` | Boolean | Allow MQTT pub/sub capabilities or restrict to Kuzzle requests only
| ``developmentMode`` | `false` | Boolean | Switches `responseTopic` back to a regular public topic
| ``disconnectDelay`` | 250 | Integer | Delay in ms to apply between a disconnection notification is received and the connection is actually removed
| ``requestTopic`` | ``"Kuzzle/request"`` | String | Name of the topic listened by the plugin for requests
| ``responseTopic`` | ``"Kuzzle/response"`` | String | Name of the topic clients should listen to get requests result
| ``server`` | `{port: 1883}` | Object | Constructor options passed to underlying mqtt server. See [mosca documentation](https://github.com/mcollina/mosca/wiki/Mosca-advanced-usage#other-options-of-mosca-the-ones-we-inserted-in-our-moscasettings-var) for further reference.

example:

`.kuzzlerc`
```json
{
  "server": {
    "protocols": {
      "mqtt": {
        "allowPubSub": true
      }
    }
  }
}
```

# How to use

## Sending an API request and getting the response

By default, this plugins listens to the `Kuzzle/request` MQTT topic (see [configuration](#configuration)) for requests to the [Kuzzle API](http://docs.kuzzle.io/api-documentation).

It then forwards Kuzzle's response to the `Kuzzle/response` MQTT topic, **and only to the client who made the initial request**.

The order of responses is not guaranteed to be the same than the order of requests.
To link a response to its original request, use the `requestId` attribute: the response will have the same `requestId` than the one provided in the request.

Example using the [MQTT NodeJS module](https://www.npmjs.com/package/mqtt):
_to use a cli client, you will need to enable development mode, please refer to [the dedicated section below](#development-mode) for instruction and examples_

```js
const
  mqtt = require('mqtt'),
  client = mqtt.connect({host: 'localhost'});

// Sending a volatile message
client.publish('Kuzzle/request', JSON.stringify({
  index: 'index',
  collection: 'collection',
  controller: 'realtime',
  action: 'publish',
  requestId: 'some unique ID',
  body: { some: "message" }
}));

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

## Using Kuzzle subscriptions

Kuzzle allows to [subscribe](http://docs.kuzzle.io/api-documentation/controller-realtime/subscribe/) to messages and events using advanced filters.

Each time a subscription request is sent, this plugin creates a dedicated MQTT topic, named after the `channel` property issued by Kuzzle.

Here are the steps to perform a Kuzzle subscription using this MQTT plugin:

* Send a subscription request to Kuzzle
* Listen to the request's resposne to get the corresponding `channel` identifier
* Subscribe to the MQTT topic named after this channel identifier

Example using the [MQTT NodeJS package](https://www.npmjs.com/package/mqtt):

```js
const
  mqtt = require('mqtt'),
  client = mqtt.connect({host: 'localhost'}),
  channels = [];

// Sending a volatile message
client.publish('Kuzzle/request', JSON.stringify({
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
}));

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
  }
  else if (channels.indexOf(topic) !== -1) {
    // Subscription notification
    console.log('Notification: ', message);
  }
});
```

# Authorizations

## Publishing

If ``allowPubSub`` is set to `false`, clients can only publish to the `requestTopic` topic (defaults to `Kuzzle/request`).

If `allowPubSub` is set to `true`, clients are only forbidden to publish to the `responseTopic` topic (defaults to `Kuzzle/response`).

:warning: **Wildcards subscribtions are not allowed**

If a client tries to publish to an unauthorized topic, his connection will immediately be shut down by the server.

## Subscribing

Subscription attempts to the ``requestTopic`` topic (defaults: `Kuzzle/request`) are ignored: client requests can only be listened by the MQTT server.

# Development mode

The MQTT `Kuzzle/response` topic is by default a special topic that acts as a private channel. Each client receives its own responses only, offering a simple first security layer.

While this behaviour is urgently recommended in production, it can bring a small drawback when testing and developping applications: it does not allow using most CLI tools.
Many CLI tools, such as Mosquitto offer two separate binaries, one for subscribing and one for publishing. These act as two different clients and the subscriber won't by default receive any response sent to the publisher.

To use these tools, one can enable the **development mode**, in which `Kuzzle/response` will act as a regular public topic.

:warning: **Do not use development mode in production!**

To enable development mode, you will need to **both** set `NODE_ENV` environment variable to `development` and set the mqtt protocol `developmentMode` to true:

```
# starting kuzzle with mqtt development mode enabled
NODE_ENV=development kuzzle_server__protocols__mqtt__developmentMode=true ./bin/kuzzle start

# client 1
$ mosquitto_sub -t Kuzzle/response

# client 2
$ mosquitto_pub -t Kuzzle/request -m '{"controller": "server", "action": "now"}'

# client 1
{"requestId":"83a63209-7633-4884-9f1a-c490ce446ddf","status":200,"error":null,"controller":"server","action":"now","collection":null,"index":null,"volatile":null,"result":{"now":1509967201489}}
```

