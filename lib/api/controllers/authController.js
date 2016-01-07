var
  q = require('q'),
  PassportWrapper = require('../core/auth/passportWrapper'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function AuthController (kuzzle) {

  this.passport = new PassportWrapper(kuzzle);

  this.logout = function (requestObject, context) {
    var
      deferred = q.defer(),
      response;

    kuzzle.pluginsManager.trigger('auth:logout', context.user)
      .then(() => {
        kuzzle.hotelClerk.removeCustomerFromAllRooms(context.connection);

        response = new ResponseObject(requestObject);
        deferred.resolve(response);
      })
      .catch(function (err) {
        deferred.reject(err);
      });

    return deferred.promise;
  };

  this.login = function (requestObject) {
    var
      deferred = q.defer(),
      strategy = requestObject.data.body.strategy || 'local',
      options = {},
      response;

    this.passport.authenticate(requestObject.data, strategy)
      .then(function (userObject) {
        if (requestObject.data.body.expiresIn) {
          options.expiresIn = requestObject.data.body.expiresIn;
        }
        kuzzle.repositories.user.generateToken(userObject._id, options)
        .then(function(token) {
          response = new ResponseObject(requestObject, {_id: userObject._id, jwt: token});
          deferred.resolve(response);
        });
      })
      .catch(function (err) {
        deferred.reject(err);
      });

    return deferred.promise;
  };

};