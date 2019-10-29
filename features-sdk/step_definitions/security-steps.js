const
  {
    Given,
    Then
  } = require('cucumber');

Given('I create a profile {string} with the following policies:', async function (profileId, dataTable) {
  let policies = this.parseObject(dataTable);
  return await this.sdk.security.createProfile(profileId, policies);
});

Given('I create a role {string} with the following policies:', async function (roleId, dataTable) {
  let controllers = this.parseObject(dataTable);
  return await this.sdk.security.createRole(roleId, { controllers }, { refresh: 'wait_for' });
});

Given('I delete the role {string}', async function (roleId) {
  // const timer = ms => new Promise(res => setTimeout(res, ms));
  // await timer(1000);
  return await this.sdk.security.deleteRole(roleId, { refresh: 'wait_for' });
});

Then('I can not delete the role {string}', async function (roleId) {
  const timer = ms => new Promise(res => setTimeout(res, ms));
  await timer(1000);
  return should(this.sdk.security.deleteRole(roleId, { refresh: 'wait_for' })).be.rejected();
});

Given('I delete the profile {string}', async function (profileId) {
  return await this.sdk.security.deleteProfile(profileId, { refresh: 'wait_for'});
});

Then('I can not delete the profile {string}', function (profileId) {
  return should(this.sdk.security.deleteProfile(profileId, { refresh: 'wait_for' })).be.rejected();
});

Given('I delete the user {string}', async function (userId) {
  return await this.sdk.security.deleteUser(userId, { refresh: 'wait_for' });
});

Given('I create a user {string} with content:', async function (userId, dataTable) {
  const content = this.parseObject(dataTable);

  const body = {
    content,
    credentials: {
      local: {
        username: userId,
        password: 'password'
      }
    }
  };

  return await this.sdk.security.createUser(userId, body);
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
