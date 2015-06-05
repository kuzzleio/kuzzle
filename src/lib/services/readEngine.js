var
  _ = require('lodash'),
  es = require('elasticsearch');

module.exports = function (kuzzle) {

  if (kuzzle.config.readEngine.host.indexOf(',') !== -1) {
    kuzzle.config.readEngine.host = kuzzle.config.readEngine.host.split(',');
  }

  this.client = new es.Client({
    host: kuzzle.config.readEngine.host
  });

  this.read = function (data) {
  };
};