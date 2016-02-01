var
  q = require('q'),
  passport = require('passport'),
  PassportResponse = require('./passportResponse'),
  BadRequestError = require('../errors/badRequestError'),
  UnauthorizedError = require('../errors/unauthorizedError'),
  InternalError = require('../errors/internalError');

module.exports = function PassportWrapper (kuzzle) {

  var
    scope = [];

  kuzzle.pluginsManager.trigger('passport:loadScope', {scope: scope})
    .then(function(modifiedRequestObject) {
      scope = modifiedRequestObject;
    });

  this.authenticate = function(request, strategy) {
    var
      deferred = q.defer(),
      response = new PassportResponse(deferred),
      error;

    try {
      if (!passport._strategy(strategy)) {
        return q.reject(new BadRequestError('Unknown authentication strategy "' + strategy + '"'));
      }
      passport.authenticate(strategy, {scope: scope[strategy]}, function(err, user, info) {
        kuzzle.pluginsManager.trigger('log:silly', 'Authenticate Info : ' + info);
        if (err !== null) {
          deferred.reject(err);
        }
        else if (user === false) {
          error = new UnauthorizedError(info.message);
          error.details = {
            subCode: error.subCodes.AuthenticationError
          };
          deferred.reject(error);
        }
        else {
          deferred.resolve({user: user});
        }
      })(request, response);
    } catch (err) {
      deferred.reject(new InternalError(err));
    }
    return deferred.promise;
  };

  kuzzle.pluginsManager.trigger('auth:loadStrategies', passport);

};