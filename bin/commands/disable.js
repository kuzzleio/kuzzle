/* eslint-disable no-console */

var
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api');

module.exports = function () {
  var
    data = {},
    service,
    kuzzle = new Kuzzle();

  service = params._[2];
  if (!service) {
    console.error('Error: missing required argument: service name');
    process.exit(1);
  }
  data.service = service;
  data.enable = false;
  data.pid = params.pid;

  return kuzzle.remoteActions.do('enableServices', data)
    .then(response => {
      console.log(response);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
};
