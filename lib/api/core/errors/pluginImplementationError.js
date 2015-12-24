var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function PluginImplementationError(message) {
  KuzzleError.call(this, message + '\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.', 400);
}
inherits(PluginImplementationError, KuzzleError);
PluginImplementationError.prototype.name = 'PluginImplementationError';

module.exports = PluginImplementationError;
