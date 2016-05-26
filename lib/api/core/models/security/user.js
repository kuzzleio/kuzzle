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

  User.prototype.getPolicies = function() {
    return this.getProfile()
      .then(profile => profile.getPolicies());
  };

  return User;
};

