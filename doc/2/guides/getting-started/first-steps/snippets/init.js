// Load the Kuzzle SDK module
const {
  Kuzzle,
  WebSocket
} = require('kuzzle-sdk');

const kuzzle = new Kuzzle(new WebSocket('kuzzle'));

const run = async () => {
  try {
    await kuzzle.connect();

    // Create a 'playground' index
    await kuzzle.index.create('playground');

    // Create a collection named 'mycollection' in playground index
    await kuzzle.collection.create(
      'playground',
      'mycollection'
    );

    console.log('playground/mycollection ready');
  } catch (error) {
    console.error(error.message);
  } finally {
    kuzzle.disconnect();
  }
};
run();