var
  Policies = require('./policies'),
  Promise = require('bluebird'),
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
      var promises = profiles.map(profile => profile.getRights(kuzzle));

      return Promise.all(promises)
        .then(results => {
          var rights = {};

          results.forEach(right => _.assignWith(rights, right, Policies.merge));

          return Promise.resolve(rights);
        });
    });
};

User.prototype.isActionAllowed = function (requestObject, context, kuzzle) {
  if (this.profilesIds === undefined || this.profilesIds.length === 0) {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    this.getProfiles(kuzzle)
      .then(profiles => {
        var error = null;
        async.some(profiles, (profile, callback) => {
          profile.isActionAllowed(requestObject, context, kuzzle)
            .then(allowed => callback(allowed))
            .catch(err => {
              error = err;
              callback(false);
            });
        }, result => {
          if (error) {
            return reject(error);
          }

          resolve(result);
        });
      })
      .catch(error => reject(error));
  });
};

module.exports = User;