var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function InternalError(message) {
  KuzzleError.call(this, message, 500);
}
inherits(InternalError, KuzzleError);
InternalError.prototype.name = 'InternalError';

module.exports = InternalError;
