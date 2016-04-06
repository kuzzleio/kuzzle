var
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api');

module.exports = function () {

  var kuzzle = new Kuzzle(false);

  kuzzle.remoteActions(kuzzle, 'enableServices', params, {enable: true});

};