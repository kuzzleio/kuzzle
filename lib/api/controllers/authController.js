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

  this.logout = function (requestObject, context) {

    return kuzzle.pluginsManager.trigger('auth:logout', context)
      .then(() => {
        return kuzzle.repositories.token.expire(context.token);
      })
      .then(() => {
        return new ResponseObject(requestObject);
      })
      .catch((err) => {
        return q.reject(new ResponseObject(requestObject, err));
      });
  };

  this.login = function (requestObject, context) {
    var
      strategy = requestObject.data.body.strategy || 'local',
      options = {};

    return this.passport.authenticate({query: requestObject.data.body}, strategy)
      .then(function (userObject) {
        if (!userObject.headers) {
          if (requestObject.data.body.expiresIn) {
            options.expiresIn = requestObject.data.body.expiresIn;
          }
          return kuzzle.repositories.token.generateToken(userObject, context, options);
        }
        return q(new ResponseObject(requestObject, userObject));
      })
      .then(function(token) {
        if (token instanceof ResponseObject) {
          return token;
        }
        return new ResponseObject(requestObject, {
          _id: token.user._id,
          jwt: token._id
        });
      })
      .catch((err) => {
        return q.reject(new ResponseObject(requestObject, err));
      });
  };

  /**
   * Returns the user identified by the given jwt token
   * @param {RequestObject} requestObject
   * @param context
   * @returns {Promise}
   */
  this.getCurrentUser = function (requestObject, context) {
    requestObject.data._id = context.token.user._id;

    return kuzzle.funnel.controllers.security.getUser(requestObject);
  };


  /**
   * Checks the validity of a token.
   *
   * @param requestObject
   */
  this.checkToken = function (requestObject) {
    if (!requestObject.data.body || !requestObject.data.body.token) {
      return q.reject(new BadRequestError('Cannot check token: no token provided'));
    }

    return kuzzle.repositories.token.verifyToken(requestObject.data.body.token)
      .then(token => {
        return q(new ResponseObject(requestObject, {valid: true, expiresAt: token.expiresAt}));
      })
      .catch(invalid => {
        if (invalid.status === 401) {
          return q(new ResponseObject(requestObject, {valid: false, state: invalid.message}));
        }

        return q.reject(new ResponseObject(requestObject, invalid));
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
      .then(user => kuzzle.repositories.user.persist(_.extend(user, modifiedRequestObject.data.body), {database: {method: 'update'}}))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser, true))
      .then(serialized => kuzzle.pluginsManager.trigger('auth:afterUpdateSelf', new ResponseObject(modifiedRequestObject, serialized)))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };
};
