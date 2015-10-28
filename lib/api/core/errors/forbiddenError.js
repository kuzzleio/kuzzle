var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function ForbiddenError(message) {
  KuzzleError.call(this, message, 403);
}
inherits(ForbiddenError, KuzzleError);
ForbiddenError.prototype.name = 'ForbiddenError';

module.exports = ForbiddenError;
