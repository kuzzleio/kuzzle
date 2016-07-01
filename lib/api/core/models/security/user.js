var
  q = require('q');

/**
 * @constructor
 */
function User () {
  this._id = null;
  this.profileId = null;
}

/**
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */
User.prototype.getProfile = function (kuzzle) {
  if (this._profile === undefined) {
    return kuzzle.repositories.profile.loadProfile(this.profileId)
      .then(profile => {
        this._profile = profile;
        return profile;
      });
  }
  return q(this._profile);
};

/**
 * @return {Promise}
 */
User.prototype.getRights = function (kuzzle) {
  return this.getProfile(kuzzle)
    .then(profile => profile.getRights(kuzzle));
};

User.prototype.isActionAllowed = function (requestObject, context, kuzzle) {
  return this.getProfile(kuzzle)
    .then(profile => profile.isActionAllowed(requestObject, context, kuzzle));
};

module.exports = User;