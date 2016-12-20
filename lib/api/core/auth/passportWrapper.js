var
  Promise = require('bluebird'),
  passport = require('passport'),
  PassportResponse = require('./passportResponse'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  InternalError = require('kuzzle-common-objects').errors.InternalError;

/**
 * @constructor
 */
function PassportWrapper () {
  this.scope = {};

  /**
   * @param {{query: Object}}request
   * @param strategy
   * @returns {Promise.<*>}
   */
  this.authenticate = function passportAuthenticate (request, strategy) {
    var
      response = new PassportResponse(),
      error;

    try {
      if (!passport._strategy(strategy)) {
        return Promise.reject(new BadRequestError('Unknown authentication strategy "' + strategy + '"'));
      }

      return new Promise((resolve, reject) => {
        response.addEndListener(() => resolve(response));

        passport.authenticate(strategy, {scope: this.scope[strategy]}, (err, user, info) => {
          if (err !== null) {
            reject(err);
          }
          else if (!user) {
            error = new UnauthorizedError(info.message);
            error.details = {
              subCode: error.subCodes.AuthenticationError
            };
            reject(error);
          }
          else {
            resolve(user);
          }
        })(request, response);
      });
    } catch (err) {
      return Promise.reject(new InternalError(err));
    }
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
   * Mainly used by the pluginContext
   */
  this.use = passport.use.bind(passport);
}

module.exports = PassportWrapper;
