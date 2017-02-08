var
  rc = require('rc'),
  /** @type KuzzleConfiguration */
  kuzzleConfig = require('../../lib/config');

module.exports = rc('kuzzle', {
  scheme: 'http',
  host: kuzzleConfig.services.proxyBroker.host,
  port: 7512
});
