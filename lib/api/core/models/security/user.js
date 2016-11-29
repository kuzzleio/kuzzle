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
User.prototype.getProfiles = function userGetProfiles (kuzzle) {
  return kuzzle.repositories.profile.loadProfiles(this.profileIds);
};

/**
 * @return {Promise}
 */
User.prototype.getRights = function userGetRights (kuzzle) {
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

/**
 * @param {Request} request
 * @param {Kuzzle} kuzzle
 * @returns {*}
 */
User.prototype.isActionAllowed = function userIsActionAllowed (request, kuzzle) {
  if (this.profileIds === undefined || this.profileIds.length === 0) {
    return Promise.resolve(false);
  }

  return this.getProfiles(kuzzle)
    .then(profiles => {
      return new Promise((resolve, reject) => {
        async.some(profiles, (profile, callback) => {
          profile.isActionAllowed(request, kuzzle).asCallback(callback);
        }, (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve(result);
        });
      });
    });
};

module.exports = User;
