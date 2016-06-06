var
  q = require('q');

module.exports = function (kuzzle) {

  function User () {
    this._id = null;
    this.profile = null;
  }

  User.prototype.getProfile = function() {
    if (typeof this.profile === 'string') {
      return kuzzle.repositories.profile.loadProfile(this.profile);
    }
    return q(this.profile);
  };

  User.prototype.getRights = function() {
    return this.getProfile()
      .then(profile => profile.getRights());
  };

  return User;
};

