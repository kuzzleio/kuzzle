// load the Kuzzle SDK module
const {
  Kuzzle,
  WebSocket
} = require('kuzzle-sdk');
const kuzzle = new Kuzzle(new WebSocket('kuzzle'));
const message = {message: 'Hello, World!'};
const run = async () => {
  try {
    await kuzzle.connect();
    await kuzzle.document.create(
      'playground',
      'mycollection',
      message
    );
    console.log('document created');
  } catch (error) {
    console.error(error.message);
  } finally {
    kuzzle.disconnect();
  }
};
run();