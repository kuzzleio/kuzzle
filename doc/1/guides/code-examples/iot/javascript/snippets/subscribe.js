const mqtt = require('mqtt');
const client = mqtt.connect({ host: 'localhost' });

try {
  // Sending a volatile message
  client.publish('Kuzzle/request', JSON.stringify({
    index: 'devices',
    collection: 'sensors',
    controller: 'realtime',
    action: 'subscribe',
    requestId: 'some-uniq-id',
    body: { }
  }));

  // Getting Kuzzle's response
  client.on('message', (topic, raw) => {
    const message = JSON.parse(Buffer.from(raw));

    // API results topic
    if (topic === 'Kuzzle/response') {
    // Response to our "publish" request
      if (message.requestId === 'some-uniq-id') {
        client.subscribe(message.result.channel);
      }
    } else {
      // Subscription notification
      console.log('Notification: ', message);
    }
  });
} catch (error) {
  console.log(error.message);
}
