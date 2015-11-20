var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function GatewayError(message) {
  KuzzleError.call(this, message, 504);
}
inherits(GatewayError, KuzzleError);
GatewayError.prototype.name = 'GatewayError';

module.exports = GatewayError;
