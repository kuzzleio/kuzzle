const {
  Kuzzle,
  WebSocket
} = require('kuzzle-sdk');

const kuzzle = new Kuzzle(new WebSocket('kuzzle'));