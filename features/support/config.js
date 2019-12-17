'use strict';

const
  rc = require('rc'),
  /** @type KuzzleConfiguration */
  kuzzleConfig = require('../../lib/config');

module.exports = rc('kuzzle', {
  scheme: 'http',
  host: 'localhost',
  port: 7512,
  services: {
    storageEngine: {
      commonMapping: kuzzleConfig.services.storageEngine.commonMapping
    }
  }
});
