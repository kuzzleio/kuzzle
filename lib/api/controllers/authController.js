var
  Promise = require('bluebird'),
  _ = require('lodash'),
  BadRequestError= require('kuzzle-common-objects').errors.BadRequestError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  Request = require('kuzzle-common-objects').Request,
  Token = require('../core/models/security/token'),
  formatProcessing = require('../core/auth/formatProcessing');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function AuthController (kuzzle) {
  /**
   * Logs the current user out
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Object>}
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
   * Attempts a login with requestObject informations against the provided strategy; local is used if strategy is not provided.
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Token>}
   */
  this.login = function authLogin (request) {
    var strategy = request.input.body.strategy || 'local';

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

        return Promise.resolve(response);
      });
  };

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Object>}
   */
  this.getCurrentUser = function authGetCurrentUser (request) {
    var userRequest = new Request({
      controller: 'security',
      action: 'getUser',
      _id: request.context.token.userId
    }, request.context);

    return kuzzle.funnel.controllers.security.getUser(userRequest);
  };

  /**
   * Returns the rights of the user identified by the given jwt token
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Object>}
   */
  this.getMyRights = function getMyRights (request) {
    var rightRequest = new Request({
      controller: 'security',
      action: 'getUser',
      _id: request.context.token.userId
    }, request.context);

    return kuzzle.funnel.controllers.security.getUserRights(rightRequest);
  };


  /**
   * Checks the validity of a token.
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Object>}
   */
  this.checkToken = function authCheckToken (request) {
    if (!request.input.body || !request.input.body.token) {
      return Promise.reject(new BadRequestError('Cannot check token: no token provided'));
    }

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
   * @param {KuzzleRequest} request
   * @returns {Promise<Object>}
   */
  this.updateSelf = function authUpdateSelf (request) {
    if (!request.context.token._id) {
      return Promise.reject(new UnauthorizedError('User must be connected in order to call updateSelf'));
    }
    if (request.input.body.profileIds) {
      return Promise.reject(new BadRequestError('profile can not be provided in updateSelf'));
    }
    if (request.input.body._id) {
      return Promise.reject(new BadRequestError('_id can not be part of the body'));
    }

    return kuzzle.repositories.user.load(request.context.token.userId)
      .then(user => kuzzle.repositories.user.persist(_.extend(user, request.input.body), {database: {method: 'update'}}))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser, true));
  };
}

module.exports = AuthController;
