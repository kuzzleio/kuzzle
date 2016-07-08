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
  return kuzzle.repositories.profile.loadProfile(this.profileId);
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