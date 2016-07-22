var
  rc = require('rc'),
  params = rc('kuzzle'),
  KuzzleServer = require('../../lib/api/kuzzleServer');

module.exports = function () {

  var kuzzle = new KuzzleServer();

  kuzzle.remoteActions.do('enableServices', params, {enable: true});
};
