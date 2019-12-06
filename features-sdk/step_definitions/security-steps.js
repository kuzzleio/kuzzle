const
  should = require('should'),
  {
    Given,
    Then
  } = require('cucumber');

Given('I create a profile {string} with the following policies:', async function (profileId, dataTable) {
  const data = this.parseObject(dataTable),
    policies = [];
  for (const [roleId, restrictedTo] of Object.entries(data)) {
    policies.push({ roleId, restrictedTo });
  }
  this.props.result = await this.sdk.security.createProfile(profileId, {policies});
});

Given('I create a role {string} with the following API rights:', async function (roleId, dataTable) {

  const controllers = this.parseObject(dataTable);
  this.props.result = await this.sdk.security.createRole(roleId, { controllers }, { refresh: 'wait_for' });
});

Then(/I (can not )?delete the role "(.*?)"/, async function (not, roleId) {

  try {
    await this.sdk.security.deleteRole(roleId, { refresh: 'wait_for' });
  }
  catch (e) {
    if (not) {
      return;
    }
    throw new Error(e);
  }
});

Then(/I (can not )?delete the profile "(.*?)"/, async function (not, profileId) {
  try {
    await this.sdk.security.deleteProfile(profileId, { refresh: 'wait_for' });
  }
  catch (e) {
    if (not) {
      return;
    }
    throw new Error(e);
  }
});

Given('I delete the user {string}', async function (userId) {
  this.props.result = await this.sdk.security.deleteUser(userId, { refresh: 'wait_for' });
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

  this.props.result = await this.sdk.security.createUser(userId, body);
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
