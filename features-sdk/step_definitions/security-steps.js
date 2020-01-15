'use strict';

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

Then(/I (can not )?"(.*?)" a role "(.*?)" with the following API rights:/, async function (not, method, roleId, dataTable) {
  const 
    controllers = this.parseObject(dataTable),
    options = { 
      force: not ? false : true
    };
  
  try {
    this.props.result = await this.sdk.security[method + 'Role'](roleId, { controllers }, options);
  }
  catch (e) {
    this.props.error = e;

    if (not) {
      return;
    }
    throw e;
  }
});

Then(/I am (not )?able to get a role with id "(.*?)"/, async function (roleId, not) {
  try {
    this.props.result = await this.sdk.security.getRole(roleId);
  }
  catch (e) {
    this.props.error = e;
    
    if (not) {
      return;
    }
    throw e;
  }
});

Then('I am able to find {int} roles by searching controller:', async function (count, dataTable) {
  const controller = this.parseObject(dataTable);

  const result = await this.sdk.security.searchRoles(controller);
  this.props.result = result;
});

Then('I am able to mGet roles and get {int} roles with the following ids:', async function (count, dataTable) {
  const data = this.parseObject(dataTable);
  const roleIds = [];
  for (const role of Object.entries(data.ids)) {
    roleIds.push(role);
  }

  this.props.result = await this.sdk.security.mGetRoles(roleIds);
});

Then(/I (can not )?delete the role "(.*?)"/, async function (not, roleId) {
  try {
    await this.sdk.security.deleteRole(roleId, { refresh: 'wait_for' });
  }
  catch (e) {
    if (not) {
      return;
    }
    throw e;
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
    throw e;
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

  this.props.result = await this.sdk.security.createUser(
    userId,
    body,
    { refresh: 'wait_for' });
});

Given('I update the role {string} with:', async function (roleId, dataTable) {
  const controllers = this.parseObject(dataTable);

  const rights = {};

  for (const [controller, actions] of Object.entries(controllers)) {
    rights[controller] = { actions };
  }

  this.props.result = await this.sdk.security.updateRole(roleId, rights, { refresh: 'wait_for' });
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
