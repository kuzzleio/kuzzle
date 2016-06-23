var
  q = require('q');

function User () {
  this._id = null;
  this.profile = null;
}

/**
 * @param {Kuzzle} kuzzle
 *
 * @return {Promise}
 */
User.prototype.getProfile = function (kuzzle) {
  if (this._profile === undefined) {
    return kuzzle.repositories.profile.loadProfile(this.profile)
      .then(profile => {
        console.log('profile', profile)
        this._profile = profile;
        return q(profile);
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