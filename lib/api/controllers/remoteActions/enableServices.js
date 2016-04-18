var
  ResponseObject = require('../../core/models/responseObject'),
  BadRequestError = require('../../core/errors/badRequestError'),
  q = require('q');

module.exports = function EnableServices (kuzzle, request) {
  if (!request.data.body.service) {
    return q.reject(new ResponseObject(request, new BadRequestError('Missing service name')));
  }

  if (request.data.body.enable === undefined) {
    return q.reject(new ResponseObject(request, new BadRequestError('Missing enable/disable tag')));
  }

  if (!kuzzle.services.list[request.data.body.service]) {
    return q.reject(new ResponseObject(request, new BadRequestError('Unknown or deactivated service: ' + request.data.body.service)));
  }

  if (!kuzzle.services.list[request.data.body.service].toggle) {
    return q.reject(new ResponseObject(request, new BadRequestError('The service ' + request.data.body.service + ' doesn\'t support on-the-fly disabling/enabling')));
  }

  return kuzzle.services.list[request.data.body.service].toggle(request.data.body.enable);
};
