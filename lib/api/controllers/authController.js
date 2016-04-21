var
  q = require('q'),
  PassportWrapper = require('../core/auth/passportWrapper'),
  BadRequestError= require('../core/errors/badRequestError'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function AuthController (kuzzle) {
  this.passport = new PassportWrapper(kuzzle);

  this.logout = function (requestObject, context) {
    return kuzzle.pluginsManager.trigger('auth:beforeLogout', context)
      .then(newContext => kuzzle.repositories.token.expire(newContext.token))
      .then(() => kuzzle.pluginsManager.trigger('auth:afterLogout', new ResponseObject(requestObject)))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

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
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject || requestObject, err)));
  };

  /**
   * Returns the user identified by the given jwt token
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
      return q.reject(new ResponseObject(requestObject, new BadRequestError('Cannot check token: no token provided')));
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

        return q.reject(new ResponseObject(modifiedRequestObject || requestObject, invalid));
      });
  };
};
