function User () {
  this._id = null;
  this.name = null;
  this.profileId = null;
}

/**
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */

User.prototype.getProfile = function (kuzzle) {
  if (!this._profile) {
    this._profile = kuzzle.repositories.list.profile.load(this.profileId);
  }
  return this._profile;
}

module.exports = User;