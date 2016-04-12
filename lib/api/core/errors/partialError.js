var
  inherits = require('util').inherits,
  KuzzleError = require('./kuzzleError');

function PartialError(message, body) {
  KuzzleError.call(this, message, 206);
  if (body) {
    this.errors = body;
    this.count = body.length;
  }
}
inherits(PartialError, KuzzleError);
PartialError.prototype.name = 'PartialError';

PartialError.prototype.toJSON = function () {
  var baseError = this.super_.toJSON();

  baseError.errors = this.errors;
  baseError.count = this.count;

  return baseError;
};

module.exports = PartialError;
