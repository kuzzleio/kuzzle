'use strict';

const rc = require('rc');

const kuzzleConfig = require('../../lib/config');

module.exports = rc('kuzzle', {
  scheme: 'http',
  host: 'localhost',
  port: 7512,
  services: {
    storageEngine: {
      commonMapping: kuzzleConfig.loadConfig().services.storageEngine.commonMapping
    }
  }
});
