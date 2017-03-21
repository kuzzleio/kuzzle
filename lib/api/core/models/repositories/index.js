const
  RoleRepository = require('./roleRepository'),
  ProfileRepository = require('./profileRepository'),
  TokenRepository = require('./tokenRepository'),
  UserRepository = require('./userRepository');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function Repositories(kuzzle) {
  this.profile = new ProfileRepository(kuzzle);
  this.role = new RoleRepository(kuzzle);
  this.user = new UserRepository(kuzzle);
  this.token = new TokenRepository(kuzzle);
}

Repositories.prototype.init = function repositoriesInit () {
  this.profile.init();
  this.role.init();
  this.user.init();
  this.token.init();
};

module.exports = Repositories;

