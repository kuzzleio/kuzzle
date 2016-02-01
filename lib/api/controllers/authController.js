var
  q = require('q'),
  PassportWrapper = require('../core/auth/passportWrapper'),
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
    return this.passport.authenticate(requestObject.data, strategy)
      .then(function (userObject) {
        if (requestObject.data.body.expiresIn) {
          options.expiresIn = requestObject.data.body.expiresIn;
        }
        return kuzzle.repositories.token.generateToken(userObject, context, options);
      })
      .then(function(token) {
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
};
