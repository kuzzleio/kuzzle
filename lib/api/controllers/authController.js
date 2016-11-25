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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('auth:beforeLogout', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.repositories.token.expire(modifiedData.userContext.token);
      })
      .then(() => kuzzle.pluginsManager.trigger('auth:afterLogout', {
        responseObject: new ResponseObject(modifiedData.requestObject, {}),
        userContext: modifiedData.userContext
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
    var
      strategy = requestObject.data.body.strategy || 'local',
      options = {},
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('auth:beforeLogin', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.passport.authenticate({query: modifiedData.requestObject.data.body}, strategy);
      })
      .then((userObject) => {
        if (!userObject.headers) {
          if (modifiedData.requestObject.data.body.expiresIn) {
            options.expiresIn = modifiedData.requestObject.data.body.expiresIn;
          }
          return kuzzle.repositories.token.generateToken(userObject, modifiedData.userContext, options);
        }

        return Promise.resolve(new ResponseObject(modifiedData.requestObject, userObject));
      })
      .then((token) => {
        if (token instanceof ResponseObject) {
          return {
            responseObject: token,
            userContext: modifiedData.userContext
          };
        }

        return kuzzle.pluginsManager.trigger('auth:afterLogin', {
          responseObject: new ResponseObject(modifiedData.requestObject, {
            _id: token.userId,
            jwt: token._id
          }),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;
    requestObject.data._id = userContext.token.userId;

    return kuzzle.pluginsManager.trigger('auth:getCurrentUser', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.funnel.controllers.security.getUser(modifiedData.requestObject, modifiedData.userContext);
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
    var
      modifiedData = null;
    requestObject.data._id = userContext.token.userId;

    return kuzzle.pluginsManager.trigger('auth:getMyRights', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.funnel.controllers.security.getUserRights(modifiedData.requestObject, modifiedData.userContext);
      });
  };


  /**
   * Checks the validity of a token.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   */
  this.checkToken = function authCheckToken (requestObject, userContext) {
    var
      modifiedData = null;

    if (!requestObject.data.body || !requestObject.data.body.token) {
      return Promise.reject(new BadRequestError('Cannot check token: no token provided'));
    }

    return kuzzle.pluginsManager.trigger('auth:beforeCheckToken', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.repositories.token.verifyToken(modifiedData.requestObject.data.body.token);
      })
      .then(token => kuzzle.pluginsManager.trigger('auth:afterCheckToken', {
        responseObject: new ResponseObject(modifiedData.requestObject, {valid: true, expiresAt: token.expiresAt}),
        userContext: modifiedData.userContext
      }))
      .catch(invalid => {
        if (invalid.status === 401) {
          return kuzzle.pluginsManager.trigger('auth:afterCheckToken', {
            responseObject: new ResponseObject(modifiedData.requestObject || requestObject, {valid: false, state: invalid.message}),
            userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('auth:beforeUpdateSelf', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        if (!modifiedData.userContext.token._id) {
          return Promise.reject(new UnauthorizedError('User must be connected in order to call updateSelf'));
        }

        if (modifiedData.requestObject.data.body.profileIds) {
          return Promise.reject(new BadRequestError('profile can not be provided in updateSelf'));
        }

        if (modifiedData.requestObject.data.body._id) {
          return Promise.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.user.load(modifiedData.userContext.token.userId);
      })
      .then(user => kuzzle.repositories.user.persist(_.extend(user, modifiedData.requestObject.data.body), { database: { method: 'update' } }))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser, true))
      .then(response => kuzzle.pluginsManager.trigger('auth:afterUpdateSelf', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };
}

module.exports = AuthController;
