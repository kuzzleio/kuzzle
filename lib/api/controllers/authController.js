var
  q = require('q'),
  PassportWrapper = require('../core/auth/passportWrapper'),
  BadRequestError= require('../core/errors/badRequestError'),
  ResponseObject = require('../core/models/responseObject');

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
        } else {
          return q(new ResponseObject(requestObject, userObject));
        }
      })
      .then(function(token) {
        if (token.user) {
          return new ResponseObject(requestObject, {
            _id: token.user._id,
            jwt: token._id
          });
        } else {
          return token;
        }
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
    kuzzle.pluginsManager.trigger('auth:getCurrentUser', requestObject);

    requestObject.data._id = context.token.user._id;

    return kuzzle.repositories.user.load(requestObject.data._id)
      .then(user => {
        var response;

        if (!user) {
          return q(new ResponseObject(requestObject, {found: false}));
        }

        if (requestObject.data.body.hydrate !== undefined && requestObject.data.body.hydrate === false) {
          response = {
            _id: user._id,
            _source: kuzzle.repositories.user.serializeToDatabase(user)
          };
        }
        else {
          response = {
            _id: user._id,
            _source: user
          };
        }
        delete response._source._id;

        return q(new ResponseObject(requestObject, response));
      });
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
};
