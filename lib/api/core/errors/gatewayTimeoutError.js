var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function GatewayTimeoutError(message) {
  KuzzleError.call(this, message, 504);
}
inherits(GatewayTimeoutError, KuzzleError);
GatewayTimeoutError.prototype.name = 'GatewayTimeoutError';

module.exports = GatewayTimeoutError;
