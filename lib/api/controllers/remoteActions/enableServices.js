var
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  Promise = require('bluebird');

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @returns {Promise}
 */
module.exports = function EnableServices (kuzzle, request) {
  if (!request.data.body.service) {
    return Promise.reject(new BadRequestError('Missing service name'));
  }

  if (request.data.body.enable === undefined) {
    return Promise.reject(new BadRequestError('Missing enable/disable tag'));
  }

  if (!kuzzle.services.list[request.data.body.service]) {
    return Promise.reject(new BadRequestError('Unknown or deactivated service: ' + request.data.body.service));
  }

  if (!kuzzle.services.list[request.data.body.service].toggle) {
    return Promise.reject(new BadRequestError('The service ' + request.data.body.service + ' doesn\'t support on-the-fly disabling/enabling'));
  }

  return kuzzle.services.list[request.data.body.service].toggle(request.data.body.enable);
};
