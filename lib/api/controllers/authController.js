var
  q = require('q'),
  PassportWrapper = require('../core/auth/passportWrapper'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function AuthController (kuzzle) {

  this.passport = new PassportWrapper(kuzzle);

  this.login = function (requestObject) {
    var
      deferred = q.defer(),
      strategy = requestObject.data.body.strategy || 'local',
      response;
    this.passport.authenticate(requestObject.data, strategy)
      .then(function (userObject) {
        kuzzle.repositories.user.generateToken(userObject._id)
        .then(function(token) {
          response = new ResponseObject(requestObject, {username: userObject._id, jwt: token});
          deferred.resolve(response);
        });
      })
      .catch(function (err) {
        deferred.reject(err);
      });

    return deferred.promise;
  };

};