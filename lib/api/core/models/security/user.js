var
  q = require('q'),
  async = require('async'),
  _ = require('lodash');

/**
 * @constructor
 */
function User () {
  this._id = null;
  this.profilesIds = [];
}

/**
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */
User.prototype.getProfiles = function (kuzzle) {
  return kuzzle.repositories.profile.loadProfiles(this.profilesIds);
};

/**
 * @return {Promise}
 */
User.prototype.getRights = function (kuzzle) {
  return this.getProfiles(kuzzle)
    .then(profiles => {
      var promises = profiles.map(profile => {
        return profile.getRights(kuzzle);
      });
      
      return q.all(promises)
        .then(results => {
          var rights = {};

          results.forEach(right => {
            _.assignWith(rights, right);
          });
          return q(rights);
        });
    });
};

User.prototype.isActionAllowed = function (requestObject, context, kuzzle) {
  var deferred;
  
  if (this.profilesIds === undefined || this.profilesIds.length === 0) {
    return q(false);
  }

  deferred = q.defer();

  this.getProfiles(kuzzle)
    .then(profiles => {
      async.some(profiles, (profile, callback) => {
        profile.isActionAllowed(requestObject, context, kuzzle)
          .then(isAllowed => {
            callback(isAllowed);
          });
      }, result => {
        deferred.resolve(result);
      });
    })
    .catch(error => deferred.reject(error));

  return deferred.promise;  
};

module.exports = User;