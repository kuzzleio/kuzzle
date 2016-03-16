var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function ParseError(message) {
  KuzzleError.call(this, message, 400);
}
inherits(ParseError, KuzzleError);
ParseError.prototype.name = 'ParseError';

module.exports = ParseError;
