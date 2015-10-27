var
  Repository = require('./repository'),
  RoleRepository = require('./roleRepository'),
  ProfileRepository = require('./profileRepository'),
  UserRepository = require('./userrepository');

module.exports = {
  profile: new ProfileRepository(),
  role: new RoleRepository(),
  user: new UserRepository()
};


