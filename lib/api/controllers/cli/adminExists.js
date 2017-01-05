const Request = require('kuzzle-common-objects').Request;
let _kuzzle;

/**
 * Process an adminExists request inside kuzzle
 *
 * @param {Request} request Original CLI Request
 * @returns {Promise}
 */
function cliRunAdminExists(request) {
  let cliRequest = request.serialize();

  Object.assign(cliRequest.data, {
    controller: 'server',
    action: 'adminExists'
  });

  return _kuzzle.funnel.processRequest(new Request(cliRequest.data, cliRequest.options))
    .then(res => res.result);
}

module.exports = function cliAdminExists (kuzzle) {
  _kuzzle = kuzzle;
  return cliRunAdminExists;
};