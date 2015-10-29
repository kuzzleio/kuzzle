var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function ServiceUnavailable(message) {
  KuzzleError.call(this, message, 503);
}
inherits(ServiceUnavailable, KuzzleError);
ServiceUnavailable.prototype.name = 'ServiceUnavailable';

module.exports = ServiceUnavailable;
