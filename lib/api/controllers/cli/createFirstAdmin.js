'use strict';

const Request = require('kuzzle-common-objects').Request;
let _kuzzle;

/**
 * Process a createFirstAdmin request inside kuzzle
 *
 * @param {Request} request Original CLI Request
 * @returns {Promise}
 */
function cliRunCreateFirstAdmin(request) {
  let cliRequest = request.serialize();

  Object.assign(cliRequest.data, {
    controller: 'security',
    action: 'createFirstAdmin'
  });

  return _kuzzle.funnel.processRequest(new Request(cliRequest.data, cliRequest.options))
    .then(res => res.result);
}

module.exports = function cliCreateFirstAdmin (kuzzle) {
  _kuzzle = kuzzle;
  return cliRunCreateFirstAdmin;
};