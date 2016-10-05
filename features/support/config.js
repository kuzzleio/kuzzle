var
  rc = require('rc'),
  kuzzleConfig = require('../../lib/config');

module.exports = rc('kuzzle', {
  scheme: 'http',
  host: kuzzleConfig.services.proxyBroker.host,
  ports: {
    rest: 7511,
    io: 7512,
    ws: 7513
  }
});
