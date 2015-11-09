var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function UnauthorizedError(message) {
  KuzzleError.call(this, message, 401);
}
inherits(UnauthorizedError, KuzzleError);
UnauthorizedError.prototype.name = 'UnauthorizedError';

UnauthorizedError.prototype.subCodes = {
  TokenExpired: 1,
  JsonWebTokenError: 2
};

module.exports = UnauthorizedError;
