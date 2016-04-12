var
  inherits = require('util').inherits,
  util = require('util');

function KuzzleError(message, status) {
  this.status = status;
  if (util.isError(message)) {
    this.message = message.message;
    this.stack = message.stack;
  } else {
    this.message = message;
    this.stack = (new Error()).stack;
  }
}
inherits(KuzzleError, Error);

KuzzleError.prototype.name = 'KuzzleError';

KuzzleError.prototype.toJSON = function () {
  return {
    status: this.status,
    message: this.message,
    stack: this.stack
  };
};

module.exports = KuzzleError;
