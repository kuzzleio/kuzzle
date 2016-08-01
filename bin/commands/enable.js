/* eslint-disable no-console */

var
  rc = require('rc'),
  params = rc('kuzzle'),
  KuzzleServer = require('../../lib/api/kuzzleServer');

module.exports = function () {
  var
    data = {},
    service,
    kuzzle = new KuzzleServer();

  service = params._[2];
  if (!service) {
    console.error('Error: missing required argument: service name');
    process.exit(1);
  }
  data.service = service;
  data.enable = true;
  data.pid = params.pid;

  kuzzle.remoteActions.do('enableServices', data);
};
