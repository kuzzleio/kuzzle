'use strict';

const
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
 * @class AuthController
 * @param {Kuzzle} kuzzle
 * @constructor
 */
class AuthController {
  constructor(kuzzle) {
    /** @type Kuzzle */
    this.kuzzle = kuzzle;
  }

  /**
   * Logs the current user out
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  logout(request) {
    return this.kuzzle.repositories.token.expire(request.context.token)
      .then(() => Promise.resolve({}))
      .catch(err => {
        const error = new InternalError('Error while forcing token expiration');
        error.details = err;

        return Promise.reject(error);
      });
  }

  /**
   * Attempts a login with request informations against the provided strategy; local is used if strategy is not provided.
   *
   * @param {Request} request
   * @returns {Promise<Token>}
   */
  login(request) {
    assertHasBody(request);

    const strategy = request.input.body.strategy || 'local';

    return this.kuzzle.passport.authenticate({query: request.input.body}, strategy)
      .then(userObject => {
        const options = {};

        if (!userObject.headers) {
          if (request.input.body.expiresIn) {
            options.expiresIn = request.input.body.expiresIn;
          }

          return this.kuzzle.repositories.token.generateToken(userObject, request, options);
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
  }

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  getCurrentUser(request) {
    return formatProcessing.formatUserForSerialization(this.kuzzle, request.context.user);
  }

  /**
   * Returns the rights of the user identified by the given jwt token
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  getMyRights(request) {
    return request.context.user.getRights(this.kuzzle)
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => Promise.resolve({hits: rights, total: rights.length}));
  }

  /**
   * Checks the validity of a token.
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  checkToken(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'token');

    return this.kuzzle.repositories.token.verifyToken(request.input.body.token)
      .then(token => Promise.resolve({valid: true, expiresAt: token.expiresAt}))
      .catch(invalid => {
        if (invalid.status === 401) {
          return Promise.resolve({valid: false, state: invalid.message});
        }

        return Promise.reject(invalid);
      });
  }

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  updateSelf(request) {
    if (request.context.user._id === this.kuzzle.repositories.user.anonymous()._id) {
      throw new UnauthorizedError('User must be connected in order to call auth:updateSelf');
    }

    assertHasBody(request);
    assertBodyHasNotAttribute(request, '_id');
    assertBodyHasNotAttribute(request, 'profileIds');

    return this.kuzzle.repositories.user.persist(_.extend(request.context.user, request.input.body), {database: {method: 'update'}})
      .then(updatedUser => formatProcessing.formatUserForSerialization(this.kuzzle, updatedUser));
  }
}

module.exports = AuthController;
