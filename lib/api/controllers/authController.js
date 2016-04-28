var
  q = require('q'),
  _ = require('lodash'),
  PassportWrapper = require('../core/auth/passportWrapper'),
  BadRequestError= require('../core/errors/badRequestError'),
  UnauthorizedError = require('../core/errors/unauthorizedError'),
  ResponseObject = require('../core/models/responseObject'),
  formatProcessing = require('../core/auth/formatProcessing');

module.exports = function AuthController (kuzzle) {
  this.passport = new PassportWrapper(kuzzle);

  /**
   * Logs the current user out
   *
   * @param {RequestObject} requestObject
   * @param context
   * @returns {Promise}
   */
  this.logout = function (requestObject, context) {
    return kuzzle.pluginsManager.trigger('auth:beforeLogout', context)
      .then(newContext => kuzzle.repositories.token.expire(newContext.token))
      .then(() => kuzzle.pluginsManager.trigger('auth:afterLogout', new ResponseObject(requestObject)))
      .catch(err => q.reject(err));
  };

  /**
   * Attempts a login with requestObject informations against the provided strategy; local is used if strategy is not provided.
   *
   * @param {RequestObject} requestObject
   * @param context
   * @returns {Promise}
   */
  this.login = function (requestObject, context) {
    var
      strategy = requestObject.data.body.strategy || 'local',
      options = {},
      modifiedContext = null,
      modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('auth:beforeLogin', {context, requestObject})
      .then(modifiedData => {
        modifiedContext = modifiedData.context;
        modifiedRequestObject = modifiedData.requestObject;

        return this.passport.authenticate({query: modifiedRequestObject.data.body}, strategy);
      })
      .then((userObject) => {
        if (!userObject.headers) {
          if (modifiedRequestObject.data.body.expiresIn) {
            options.expiresIn = modifiedRequestObject.data.body.expiresIn;
          }
          return kuzzle.repositories.token.generateToken(userObject, modifiedContext, options);
        }

        return q(new ResponseObject(modifiedRequestObject, userObject));
      })
      .then((token) => {
        if (token instanceof ResponseObject) {
          return token;
        }

        return kuzzle.pluginsManager.trigger('auth:afterLogin', new ResponseObject(modifiedRequestObject, {
          _id: token.user._id,
          jwt: token._id
        }));
      })
      .catch(err => q.reject(err));
  };

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {RequestObject} requestObject
   * @param context
   * @returns {Promise}
   */
  this.getCurrentUser = function (requestObject, context) {
    requestObject.data._id = context.token.user._id;

    return kuzzle.pluginsManager.trigger('auth:getCurrentUser', requestObject)
      .then(newRequestObject => kuzzle.funnel.controllers.security.getUser(newRequestObject));
  };


  /**
   * Checks the validity of a token.
   *
   * @param requestObject
   */
  this.checkToken = function (requestObject) {
    var modifiedRequestObject;

    if (!requestObject.data.body || !requestObject.data.body.token) {
      return q.reject(new BadRequestError('Cannot check token: no token provided'));
    }

    return kuzzle.pluginsManager.trigger('auth:beforeCheckToken', requestObject)
      .then((newRequestObject) => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.repositories.token.verifyToken(modifiedRequestObject.data.body.token);
      })
      .then(token => kuzzle.pluginsManager.trigger('auth:afterCheckToken', new ResponseObject(modifiedRequestObject, {valid: true, expiresAt: token.expiresAt})))
      .catch(invalid => {
        if (invalid.status === 401) {
          return q(new ResponseObject(modifiedRequestObject || requestObject, {valid: false, state: invalid.message}));
        }

        return q.reject(invalid);
      });
  };

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {RequestObject} requestObject
   * @param context
   * @returns {Promise}
   */
  this.updateSelf = function (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('auth:beforeUpdateSelf', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        if (!context.token._id) {
          return q.reject(new UnauthorizedError('User must be connected in order to call updateSelf'));
        }

        if (modifiedRequestObject.data.body.profile) {
          return q.reject(new BadRequestError('profile can not be provided in updateSelf'));
        }

        if (modifiedRequestObject.data.body._id) {
          return q.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.user.load(context.token.user._id);
      })
      .then(user => kuzzle.repositories.user.persist(_.extend(user, modifiedRequestObject.data.body), { database: { method: 'update' } }))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser, true))
      .then(serialized => kuzzle.pluginsManager.trigger('auth:afterUpdateSelf', new ResponseObject(modifiedRequestObject, serialized)))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };
};
