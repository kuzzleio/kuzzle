const
  rc = require('rc'),
  /** @type KuzzleConfiguration */
  kuzzleConfig = require('../../lib/config');

module.exports = rc('kuzzle', {
  scheme: 'http',
  host: 'localhost',
  port: 7512,
  services: {
    engineEngine: {
      commonMapping: kuzzleConfig.services.storageEngine.commonMapping
    }
  }
});
