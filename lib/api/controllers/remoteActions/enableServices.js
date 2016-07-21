var
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  Promise = require('bluebird'),
  _kuzzle;

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @returns {Promise}
 */
function enableServices (request) {
  if (!request.data.body.service) {
    return Promise.reject(new BadRequestError('Missing service name'));
  }

  if (request.data.body.enable === undefined) {
    return Promise.reject(new BadRequestError('Missing enable/disable tag'));
  }

  if (!_kuzzle.services.list[request.data.body.service]) {
    return Promise.reject(new BadRequestError('Unknown or deactivated service: ' + request.data.body.service));
  }

  if (!_kuzzle.services.list[request.data.body.service].toggle) {
    return Promise.reject(new BadRequestError('The service ' + request.data.body.service + ' doesn\'t support on-the-fly disabling/enabling'));
  }

  return _kuzzle.services.list[request.data.body.service].toggle(request.data.body.enable);
}

module.exports = function (kuzzle) {
  _kuzzle = kuzzle;
  return enableServices;
};
