const mqtt = require('mqtt');
const client = mqtt.connect({ host: 'localhost' });

// Sending a volatile message
try {
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
} catch (error) {
  console.log(error.message);
} finally {
  client.end();
}
