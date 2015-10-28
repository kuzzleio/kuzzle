module.exports = function (kuzzle) {
  var
    RoleRepository = require('./roleRepository')(kuzzle),
    ProfileRepository = require('./profileRepository')(kuzzle),
    UserRepository = require('./userrepository')(kuzzle);


  return {
    profile: new ProfileRepository(),
    role: new RoleRepository(),
    user: new UserRepository()
  };
};


