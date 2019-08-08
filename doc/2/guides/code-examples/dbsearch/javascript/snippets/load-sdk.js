const {
  Kuzzle,
  WebSocket
} = require('kuzzle-sdk');

// Replace 'kuzzle' with your Kuzzle server hostname. (example: 'localhost')
const kuzzle = new Kuzzle(
  new WebSocket('kuzzle')
);
