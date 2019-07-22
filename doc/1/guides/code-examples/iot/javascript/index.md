---
code: false
type: page
title: Javascript
---

## IoT with Javascript

For this example we will use Node.js. You will need to install Node.js and NPM.

Let's create a new project folder called `iot` and add a MQTT client to it:

```bash
mkdir iot
cd iot
npm init
npm install mqtt
```

Now the project configuration is complete, we can create a `subscribe.js` and a `publish.js` files in the `iot` folder to program our example.

```bash
touch subscribe.js publish.js
```

## Connect to Kuzzle

In both files, the first thing we need to do is to connect to Kuzzle. To do this add the following code:

```js
const mqtt = require('mqtt'),
  //Connect to Kuzzle
  client = mqtt.connect({ host: 'localhost' });
```

Here we assume Kuzzle is accessible locally. If this is not the case, replace `localhost` with the IP address or with the server name of your Kuzzle server.

## Publish a message to Kuzzle

Now let's move on to the publish side of the test. Here we will publish a message to Kuzzle using the MQTT protocol, sending a sensor information.

To do so, add the following code to your `publish.js` file:

```js
// Sending a volatile message
client.publish('Kuzzle/request', JSON.stringify({
    index: 'devices',
    collection: 'sensors',
    controller: 'realtime',
    action: 'publish',
    requestId: 'some-uniq-id',
    _id: 'document-uniq-identifier',
    body: {
      command: 'battery-report'
    }
  }));
```

## Subscribe to notifications

Now we will subscribe to the Kuzzle `Kuzzle/response` topic, so that the client can be notified about published messages.

Before continuing this guide, a word about how the MQTT topics are organized by Kuzzle:

1. API requests must be sent to the `Kuzzle/request` topic. For security reasons, this topic is write-only, Kuzzle forbids subscriptions to it.

2. API responses are sent by Kuzzle to the read-only `Kuzzle/response` topic. This topic is special: despite being a public topic, API responses are private, and sent only to the requesting user (unless you set the `developmentMode` option to true, which is not advisable in production for obvious security reasons)

3. Real-time notifications topic: when you send a real-time subscription to Kuzzle, it sends back a response with a `channel` identifier (a "channel" is a real-time subscription ID), and it also creates a MQTT topic named after that identifier. To receive real-time notifications, you have then to subscribe to this new, dedicated topic.
   Now that's out of the way, let's add a listener handler, for both our API responses and for real-time notifications:

```js
// Getting Kuzzle's response
client.on('message', (topic, raw) => {
  const message = JSON.parse(Buffer.from(raw));
  // API results topic
  if (topic === 'Kuzzle/response') {
    // Response to our subscription request: we need to subscribe
    // to the new MQTT notifications topic
    if (message.requestId === 'some-uniq-id' && message.result && message.result.channel) {
      client.subscribe(message.result.channel);
    }
  } else {
    // Subscription notification
    console.log('Notification: ', message);
  }
});
```

We have now programmed the subscription side of the MQTT transport.

## Run the example

The full code of your `publish.js` file should look like this:

<<< ./snippets/publish.js

And your `subscribe.js` file should look like this:

<<< ./snippets/subscribe.js

Now, run the following command in a terminal: it will display real-time notifications.

```bash
node subscribe.js
```

Run the following command in another terminal, as many times as you want to. Your other terminal should show a new notification each time the `publish.js` program is executed:

```bash
node publish.js
```
