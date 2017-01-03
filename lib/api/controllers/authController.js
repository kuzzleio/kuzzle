'use strict';

var
  Promise = require('bluebird'),
  _ = require('lodash'),
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  Token = require('../core/models/security/token'),
  formatProcessing = require('../core/auth/formatProcessing'),
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertBodyHasNotAttribute = require('./util/requestAssertions').assertBodyHasNotAttribute,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function AuthController (kuzzle) {
  /**
   * Logs the current user out
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  this.logout = function authLogout (request) {
    return kuzzle.repositories.token.expire(request.context.token)
      .then(() => Promise.resolve({}))
      .catch(err => {
        var error = new InternalError('Error expiring token');
        error.details = err;

        return Promise.reject(error);
      });
  };

  /**
   * Attempts a login with request informations against the provided strategy; local is used if strategy is not provided.
   *
   * @param {Request} request
   * @returns {Promise<Token>}
   */
  this.login = function authLogin (request) {
    var strategy;

    assertHasBody(request, 'auth:login');
    strategy = request.input.body.strategy || 'local';

    return kuzzle.passport.authenticate({query: request.input.body}, strategy)
      .then(userObject => {
        var options = {};
        if (!userObject.headers) {
          if (request.input.body.expiresIn) {
            options.expiresIn = request.input.body.expiresIn;
          }
          return kuzzle.repositories.token.generateToken(userObject, request, options);
        }

        return Promise.resolve(userObject);
      })
      .then(response => {
        if (response instanceof Token) {
          return Promise.resolve({
            _id: response.userId,
            jwt: response._id
          });
        }

        return response;
      });
  };

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  this.getCurrentUser = function authGetCurrentUser (request) {
    return formatProcessing.formatUserForSerialization(kuzzle, request.context.user);
  };

  /**
   * Returns the rights of the user identified by the given jwt token
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  this.getMyRights = function getMyRights (request) {
    return request.context.user.getRights(kuzzle)
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => Promise.resolve({hits: rights, total: rights.length}));
  };

  /**
   * Checks the validity of a token.
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  this.checkToken = function authCheckToken (request) {
    assertHasBody(request, 'auth:checkToken');
    assertBodyHasAttribute(request, 'token', 'auth:checkToken');

    return kuzzle.repositories.token.verifyToken(request.input.body.token)
      .then(token => Promise.resolve({valid: true, expiresAt: token.expiresAt}))
      .catch(invalid => {
        if (invalid.status === 401) {
          return Promise.resolve({valid: false, state: invalid.message});
        }

        return Promise.reject(invalid);
      });
  };

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  this.updateSelf = function authUpdateSelf (request) {
    if (request.context.user._id === kuzzle.repositories.user.anonymous()._id) {
      throw new UnauthorizedError('User must be connected in order to call auth:updateSelf');
    }

    assertHasBody(request, 'auth:updateSelf');
    assertBodyHasNotAttribute(request, '_id', 'auth:updateSelf');
    assertBodyHasNotAttribute(request, 'profileIds', 'auth:updateSelf');

    return kuzzle.repositories.user.persist(_.extend(request.context.user, request.input.body), {database: {method: 'update'}})
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser));
  };
}

module.exports = AuthController;
