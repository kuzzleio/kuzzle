var
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  q = require('q');

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @returns {Promise<T>}
 */
module.exports = function EnableServices (kuzzle, request) {
  if (!request.data.body.service) {
    return q.reject(new BadRequestError('Missing service name'));
  }

  if (request.data.body.enable === undefined) {
    return q.reject(new BadRequestError('Missing enable/disable tag'));
  }

  if (!kuzzle.services.list[request.data.body.service]) {
    return q.reject(new BadRequestError('Unknown or deactivated service: ' + request.data.body.service));
  }

  if (!kuzzle.services.list[request.data.body.service].toggle) {
    return q.reject(new BadRequestError('The service ' + request.data.body.service + ' doesn\'t support on-the-fly disabling/enabling'));
  }

  return kuzzle.services.list[request.data.body.service].toggle(request.data.body.enable);
};
