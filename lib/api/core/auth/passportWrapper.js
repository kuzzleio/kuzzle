var
  q = require('q'),
  passport = require('passport'),
  PassportResponse = require('./passportResponse'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  UnauthorizedError = require('kuzzle-common-objects').Errors.unauthorizedError,
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * @constructor
 */
function PassportWrapper () {
  this.scope = {};

  this.authenticate = function (request, strategy) {
    var
      deferred = q.defer(),
      response = new PassportResponse(deferred),
      error;

    try {
      if (!passport._strategy(strategy)) {
        return q.reject(new BadRequestError('Unknown authentication strategy "' + strategy + '"'));
      }
      passport.authenticate(strategy, {scope: this.scope[strategy]}, (err, user, info) => {
        if (err !== null) {
          deferred.reject(err);
        }
        else if (user === false) {
          error = new UnauthorizedError(info.message);
          error.details = {
            subCode: error.subCodes.AuthenticationError
          };
          deferred.reject(error);
        }
        else {
          deferred.resolve(user);
        }
      })(request, response);
    } catch (err) {
      deferred.reject(new InternalError(err));
    }
    return deferred.promise;
  };

  /**
   * Adds a scope for a strategy in this.scope
   * Used by passport.authenticate
   *
   * @param {string} strategy name
   * @param {Array} scope - list of fields in the strategy's scope
   */
  this.injectScope = (strategy, scope) => {
    this.scope[strategy] = scope;
  };

  /**
   * Exposes passport.use function
   * Mainly used by the plugin context
   */
  this.use = passport.use.bind(passport);
}

module.exports = PassportWrapper;
