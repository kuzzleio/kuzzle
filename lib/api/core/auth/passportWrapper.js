var
  q = require('q'),
  passport = require('passport');

module.exports = function PassportWrapper (kuzzle) {

  this.authenticate = function(request, strategy) {
    var
      deferred = q.defer();

    try {
      if (!passport._strategy(strategy)) {
        return q.reject(new Error('Unknown authentication strategy "' + strategy + '"'));
      }
      passport.authenticate(strategy, function(err, user, info) {
        kuzzle.pluginsManager.trigger('log:silly', 'Authenticate Info : ' + info);
        if (err !== null) {
          deferred.reject(err);
        }
        else if (user === false) {
          deferred.reject(new Error(info.message));
        }
        else {
          deferred.resolve(user);
        }
      })(request);
    } catch (err) {
      deferred.reject(new Error('Error authenticating user'));
    }
    return deferred.promise;
  };

  kuzzle.pluginsManager.trigger('auth:loadStrategies', passport);

};