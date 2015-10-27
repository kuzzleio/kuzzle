var
  q = require('q'),
  Profile = require('../security/profile'),
  Repository = require('./repository'),
  kuzzle = require('../../../../../lib');


function ProfileRepository () {
  this.profiles = {};
}

ProfileRepository.prototype = new Repository({
  collection: '_kuzzle/profiles',
  ObjectConstructor: Profile,
  cacheEngine: kuzzle.services.list.userCache
});


ProfileRepository.prototype.loadProfile = function (profileKey) {
  var
    deferred = q.defer();

  if (this.profiles[profileKey]) {
    deferred.resolve(this.profiles[profileKey]);
  }
  else {
    this.loadOneFromDatabase(profileKey)
      .then(function (result) {
        var
          data,
          p;

        if (result) {
          // we got a profile from the database, we can use it
          this.profiles[profileKey] = result;
          deferred.resolve(result);
        }
        else if (kuzzle.config.defaultUserProfiles[profileKey]) {
          // no profile found in db but we have a default config to it
          data = kuzzle.config.defaultUserProfiles[profileKey];

          p = new Profile();
          this.hydrate(p, data)
            .then(function (profile) {
              this.profiles[profileKey] = profile;
              deferred.resolve(profile);
            }.bind(this))
            .catch(function (error) {
              deferred.reject(error);
            });
        }
        else {
          // no profile found
          deferred.resolve(null);
        }
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });
  }

  return deferred.promise;
};


ProfileRepository.prototype.hydrate = function (profile, data) {
  var
    deferred = q.defer();

  kuzzle.repositories.role.loadRoles(data.roles)
    .then(function (roles) {
      profile.roles = roles;

      Object.keys(data).forEach(function (key) {
        if (key !== 'roles') {
          profile[key] = data[key];
        }
      });

      deferred.resolve(profile);
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};


module.exports = ProfileRepository;
