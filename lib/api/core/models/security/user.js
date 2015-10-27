var
  q = require('q'),
  kuzzle = require('../../../../../lib');

function User () {
  this._id = null;
  this.profile = null;
}

User.prototype.persist = function () {
  return this.userRepository.persist(this);
};

module.exports = User;
