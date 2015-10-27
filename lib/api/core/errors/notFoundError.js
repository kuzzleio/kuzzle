var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function NotFoundError(message) {
  KuzzleError.call(this, message, 404);
}
inherits(NotFoundError, KuzzleError);
NotFoundError.prototype.name = 'NotFoundError';

module.exports = NotFoundError;
