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

Given(/I (can not )?create a role "(.*?)" with the following API rights:/, async function (not, roleId, dataTable) {

  const controllers = this.parseObject(dataTable);

  try {
    this.props.result = await this.sdk.security.createRole(roleId, { controllers }, { refresh: 'wait_for' });
  } catch (e) {
    if (not) {
      return;
    }
    throw new Error(e);
  }
});

Given(/I (.*?) a role "(.*?)" with the following plugin (invalid )?API rights:/, async function (method, roleId, invalid, dataTable) {

  const controllers = this.parseObject(dataTable);
  try {
    await this.sdk.security[method + 'Role'](roleId, { controllers }, { refresh: 'wait_for' });
  } catch (e) {
    if ( invalid
      && e.id === 'security.role.invalid_plugin_rights'
      && e.status === 206
    ) {
      return;
    }
    throw new Error(e);
  }
});

Then(/I update the role "(.*?)" with the following content:/, async function (roleId, dataTable) {

  const controllers = this.parseObject(dataTable);

  try {
    this.props.result = await this.sdk.security.updateRole(roleId, { controllers }, { refresh: 'wait_for' });
  } catch (e) {
    throw new Error(e);
  }
});

Then(/I am (not )?able to get a role with id "(.*?)"/, async function (roleId, not) {

  try {
    this.props.result = await this.sdk.security.getRole(roleId);
  } catch (e) {
    if (not) {
      return;
    }
    throw new Error(e);
  }
});

Then('I am able to find {int} roles by searching controller:', async function (count, dataTable) {

  const controller = this.parseObject(dataTable);

  try {
    this.props.result = await this.sdk.security.searchRoles(controller);
    if (this.props.result.hits.length !== count) {
      throw new Error(`Expected ${count} roles to be found : got ${this.props.result.hits.length}.`);
    }
  } catch (e) {
    throw new Error(e);
  }
});

Then('I am able to mGet roles and get {int} roles with the following ids:', async function (count, dataTable) {

  const data = this.parseObject(dataTable);
  const roleIds = [];
  for (const role of Object.entries(data.ids)) {
    roleIds.push(role);
  }

  try {
    this.props.result = await this.sdk.security.mGetRoles(roleIds);//['test-role', 'test-role-2', 'test-role-3',]);
    if (this.props.result.length !== count) {
      throw new Error(`Exptected ${count} roles, but go ${this.props.result.length}`);
    }
  } catch (e) {
    throw new Error(e);
  }
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
