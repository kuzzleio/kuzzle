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
  this.profileIds = [];
}

/**
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */
User.prototype.getProfiles = function (kuzzle) {
  return kuzzle.repositories.profile.loadProfiles(this.profileIds);
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
  if (this.profileIds === undefined || this.profileIds.length === 0) {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    this.getProfiles(kuzzle)
      .then(profiles => {
        async.some(profiles, (profile, callback) => {
          profile.isActionAllowed(requestObject, context, kuzzle).asCallback(callback);
        }, (error, result) => {
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
