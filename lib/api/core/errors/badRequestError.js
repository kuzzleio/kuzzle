var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function BadRequestError(message) {
  KuzzleError.call(this, message, 400);
}
inherits(BadRequestError, KuzzleError);
BadRequestError.prototype.name = 'BadRequestError';

module.exports = BadRequestError;
