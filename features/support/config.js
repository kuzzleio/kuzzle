const
  rc = require('rc'),
  /** @type KuzzleConfiguration */
  kuzzleConfig = require('../../lib/config');

module.exports = rc('kuzzle', {
  scheme: 'http',
  host: kuzzleConfig.server.proxy.host || kuzzleConfig.services.proxyBroker.host || 'localhost',
  port: 7512,
  services: {
    db: {
      commonMapping: kuzzleConfig.services.db.commonMapping
    }
  }
});
