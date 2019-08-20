const {
  Kuzzle,
  WebSocket
} = require('kuzzle-sdk');
const kuzzle = new Kuzzle(new WebSocket('kuzzle'));
// Create a filter that defines that the 'message' field exists
const filter = {exists: {field: 'message'}};
// Triggered whenever a document matching the filter is submitted to Kuzzle
const callback = notification => {
  console.log(notification.result._source.message);
};
const run = async () => {
  try {
    await kuzzle.connect();
    /* Create a subscription that triggers a notification
    whenever a user publishes a document with the field 'message' */
    await kuzzle.realtime.subscribe(
      'myindex',
      'mycollection',
      filter,
      callback
    );
    await kuzzle.realtime.publish(
      'myindex',
      'mycollection',
      {message: 'hello world'}
    );
  } catch (error) {
    console.error(error);
  } finally {
    kuzzle.disconnect();
  }
};
run();