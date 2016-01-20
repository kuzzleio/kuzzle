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
};