module.exports = function Repositories (kuzzle) {
  var
    RoleRepository = require('./roleRepository')(kuzzle),
    ProfileRepository = require('./profileRepository')(kuzzle),
    TokenRepository = require('./tokenRepository')(kuzzle),
    UserRepository = require('./userRepository')(kuzzle);


  return {
    profile: new ProfileRepository(),
    role: new RoleRepository(),
    user: new UserRepository(),
    token: new TokenRepository()
  };
};


