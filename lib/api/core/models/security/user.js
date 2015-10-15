var
  q = require('q')
  Profile = require('./profile');

function User (userRepository) {
  this.userRepository = userRepository;

  this._id = null;
  this.profile = null;
}

User.prototype.hydrate = function (data) {
  Object.keys(data).forEach(function (key) {
    this[key] = data[key];
  }.bind(this));

  return this;
};

User.prototype.anonymous = function (userRepository) {
  var
    user = new User(userRepository);

  user._id = -1;
  user.profile = new Profile('anonymous');

  return user;
};

User.prototype.persist = function () {
  return this.userRepository.persist(this);
};

module.exports = User;
