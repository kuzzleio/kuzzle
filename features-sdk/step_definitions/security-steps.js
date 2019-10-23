const
  {
    Given
  } = require('cucumber');

Given('I create a profile {string} with the following policies:', function (profileId, dataTable) {
  let policies = this.parseObject(dataTable);

  policies = Array.isArray(policies) ? policies : [policies];

  return this.sdk.security.createProfile(profileId, { policies });
});

Given('I delete the role {string}', function (roleId) {
  return this.sdk.security.deleteRole(roleId);
});

Given('I create a user {string} with content:', function (userId, dataTable) {
  const content = this.parseObject(dataTable);

  const user = {
    content,
    credentials: {
      local: {
        username: userId,
        password: 'password'
      }
    }
  };

  return this.sdk.security.createUser(userId, user);
});

Given('I update the role {string} with:', async function (roleId, dataTable) {
  const controllers = this.parseObject(dataTable);

  const rights = {};

  for (const [controller, actions] of Object.entries(controllers)) {
    rights[controller] = { actions };
  }

  this.props.result = await this.sdk.security.updateRole(roleId, rights);
});

Given('The role {string} should match the default one', async function (roleId) {
  const
    defaultRoles = this.kuzzleConfig.security.standard.roles,
    role = await this.sdk.security.getRole(roleId);

  for (const [controller, actions] of Object.entries(role.controllers)) {
    should(actions).match(defaultRoles[roleId].controllers[controller]);
  }
});

Given('The role {string} should match:', async function (roleId, dataTable) {
  const
    controllers = this.parseObject(dataTable),
    role = await this.sdk.security.getRole(roleId);

  for (const [controller, actions] of Object.entries(controllers)) {
    should(actions).match(role.controllers[controller].actions);
  }
});
