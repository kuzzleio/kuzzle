var
  Promise = require('bluebird'),
  _ = require('lodash'),
  BadRequestError= require('kuzzle-common-objects').Errors.badRequestError,
  UnauthorizedError = require('kuzzle-common-objects').Errors.unauthorizedError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  formatProcessing = require('../core/auth/formatProcessing');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function AuthController (kuzzle) {
  /**
   * Logs the current user out
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.logout = function authLogout (requestObject, userContext) {
    return kuzzle.repositories.token.expire(userContext.token)
      .then(() => Promise.resolve({
        responseObject: new ResponseObject(requestObject, {}),
        userContext
      }));
  };

  /**
   * Attempts a login with requestObject informations against the provided strategy; local is used if strategy is not provided.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.login = function authLogin (requestObject, userContext) {
    var strategy = requestObject.data.body.strategy || 'local';

    return kuzzle.passport.authenticate({query: modifiedData.requestObject.data.body}, strategy)
      .then((userObject) => {
        var options = {};
        if (!userObject.headers) {
          if (requestObject.data.body.expiresIn) {
            options.expiresIn = requestObject.data.body.expiresIn;
          }
          return kuzzle.repositories.token.generateToken(userObject, userContext, options);
        }

        return Promise.resolve(new ResponseObject(requestObject, userObject));
      })
      .then((token) => {
        if (token instanceof ResponseObject) {
          return Promise.resolve({
            responseObject: token,
            userContext
          });
        }

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, {
            _id: token.userId,
            jwt: token._id
          }),
          userContext
        });
      });
  };

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getCurrentUser = function authGetCurrentUser (requestObject, userContext) {
    requestObject.data._id = userContext.token.userId;

    return kuzzle.funnel.controllers.security.getUser(requestObject, userContext)
      .then(responseObject => {
        return Promise.resolve({
          responseObject,
          userContext
        });
      });
  };

  /**
   * Returns the rights of the user identified by the given jwt token
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getMyRights = function getMyRights (requestObject, userContext) {
    requestObject.data._id = userContext.token.userId;

    return kuzzle.funnel.controllers.security.getUserRights(requestObject, userContext)
      .then(responseObject => {
        return Promise.resolve({
          responseObject,
          userContext
        });
      });
  };


  /**
   * Checks the validity of a token.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   */
  this.checkToken = function authCheckToken (requestObject, userContext) {
    if (!requestObject.data.body || !requestObject.data.body.token) {
      return Promise.reject(new BadRequestError('Cannot check token: no token provided'));
    }

    return kuzzle.repositories.token.verifyToken(requestObject.data.body.token)
      .then(token => Promise.resolve({
        responseObject: new ResponseObject(requestObject, {valid: true, expiresAt: token.expiresAt}),
        userContext
      }))
      .catch(invalid => {
        if (invalid.status === 401) {
          return Promise.resolve({
            responseObject: new ResponseObject(requestObject || requestObject, {valid: false, state: invalid.message}),
            userContext
          });
        }

        return Promise.reject(invalid);
      });
  };

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateSelf = function authUpdateSelf (requestObject, userContext) {
    if (!userContext.token._id) {
      return Promise.reject(new UnauthorizedError('User must be connected in order to call updateSelf'));
    }
    if (requestObject.data.body.profileIds) {
      return Promise.reject(new BadRequestError('profile can not be provided in updateSelf'));
    }
    if (requestObject.data.body._id) {
      return Promise.reject(new BadRequestError('_id can not be part of the body'));
    }

    return kuzzle.repositories.user.load(userContext.token.userId)
      .then(user => kuzzle.repositories.user.persist(_.extend(user, requestObject.data.body), {database: {method: 'update'}}))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser, true))
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };
}

module.exports = AuthController;
