var
  q = require('q');

module.exports = function () {

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
          this._profile = profile;
          return q(profile);
        });
    }
    return q(this._profile);
  };

  /**
   * @return {Promise}
   */
  User.prototype.getRights = function () {
    return this.getProfile()
      .then(profile => profile.getRights());
  };

  return User;
};