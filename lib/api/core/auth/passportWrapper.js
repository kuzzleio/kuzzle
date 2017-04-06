const
  Promise = require('bluebird'),
  passport = require('passport'),
  PassportResponse = require('./passportResponse'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError;

/**
 * @class PassportWrapper
 */
class PassportWrapper {
  constructor() {
    this.scope = {};
  }

  /**
   * @param {{query: Object}}request
   * @param strategy
   * @returns {Promise.<*>}
   */
  authenticate(request, strategy) {
    const response = new PassportResponse();

    if (!passport._strategy(strategy)) {
      return Promise.reject(new BadRequestError('Unknown authentication strategy "' + strategy + '"'));
    }

    return new Promise((resolve, reject) => {
      response.addEndListener(() => resolve(response));

      passport.authenticate(strategy, {scope: this.scope[strategy]}, (err, user, info) => {
        if (err !== null) {
          reject(new PluginImplementationError(err));
        }

        else if (!user) {
          const error = new UnauthorizedError(info.message);
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
  }

  /**
   * Adds a scope for a strategy in this.scope
   * Used by passport.authenticate
   *
   * @param {string} strategy name
   * @param {Array} scope - list of fields in the strategy's scope
   */
  injectScope(strategy, scope) {
    this.scope[strategy] = scope;
  }

  /**
   * Exposes passport.use function
   * Mainly used by the pluginContext
   *
   * @param {string} name - strategy name
   * @param {object} strategy - instantiated strategy object
   */
  use(name, strategy) {
    passport.use(name, strategy);
  }
}

module.exports = PassportWrapper;
