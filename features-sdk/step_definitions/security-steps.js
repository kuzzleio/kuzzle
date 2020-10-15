'use strict';

const _ = require('lodash');
const should = require('should');
const { Then } = require('cucumber');

Then(/I create a (strict )?profile "(.*?)" with the following policies:/, async function (strict, profileId, dataTable) {
  const data = this.parseObject(dataTable);
  const policies = [];

  for (const [roleId, restrictedTo] of Object.entries(data)) {
    policies.push({ roleId, restrictedTo });
  }

  if (!strict) {
    this.props.result = await this.sdk.security.createProfile(profileId, {
      policies,
    });
  }
  else {
    // using sdk.query until createProfile handles the new "strict" option
    this.props.result = await this.sdk.query({
      controller: 'security',
      action: 'createProfile',
      _id: profileId,
      body: { policies },
      strict: true,
    });
  }
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

Then(/I am (not )?able to get a role with id "(.*?)"/, async function (not, roleId) {
  this.props.error = null;

  try {
    this.props.result = await this.sdk.security.getRole(roleId);
  }
  catch (e) {
    this.props.error = e;
  }

  if (not && !this.props.error) {
    throw new Error(`Role ${roleId} exists`);
  }

  if (!not && this.props.error) {
    throw this.props.error;
  }
});

Then(/I am (not )?able to get a profile with id "(.*?)"/, async function (not, profileId) {
  this.props.error = null;

  try {
    this.props.result = await this.sdk.security.getProfile(profileId);
  }
  catch (e) {
    this.props.error = e;
  }

  if (not && !this.props.error) {
    throw new Error(`Profile ${profileId} exists`);
  }

  if (!not && this.props.error) {
    throw this.props.error;
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
  for (const role of Object.values(data.ids)) {
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

Then('I delete the user {string}', async function (userId) {
  this.props.result = await this.sdk.security.deleteUser(userId, { refresh: 'wait_for' });
});

Then('I create a user {string} with content:', async function (userId, dataTable) {
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

Then('I update the role {string} with:', async function (roleId, dataTable) {
  const controllers = this.parseObject(dataTable);

  const rights = {};

  for (const [controller, actions] of Object.entries(controllers)) {
    rights[controller] = { actions };
  }

  this.props.result = await this.sdk.security.updateRole(roleId, rights, { refresh: 'wait_for' });
});

Then('The role {string} should match the default one', async function (roleId) {
  const
    defaultRoles = this.kuzzleConfig.security.standard.roles,
    role = await this.sdk.security.getRole(roleId);

  for (const [controller, actions] of Object.entries(role.controllers)) {
    should(actions).match(defaultRoles[roleId].controllers[controller]);
  }
});

Then('The role {string} should match:', async function (roleId, dataTable) {
  const
    controllers = this.parseObject(dataTable),
    role = await this.sdk.security.getRole(roleId);

  for (const [controller, actions] of Object.entries(controllers)) {
    should(actions).match(role.controllers[controller].actions);
  }
});

Then('The profile {string} policies should match:', async function (profileId, dataTable) {
  const expectedPolicies = this.parseObjectArray(dataTable);

  const profile = await this.sdk.security.getProfile(profileId);

  should(profile.policies).have.length(expectedPolicies.length);

  for (let i = 0; i < profile.policies; i++) {
    should(profile.policies[i]).match(expectedPolicies[i]);
  }
});

Then('The user {string} should have the following profiles:', async function (userId, dataTable) {
  const expectedProfiles = _.flatten(dataTable.rawTable);

  const user = await this.sdk.security.getUser(userId);

  should(user.profileIds).be.eql(expectedProfiles);
});

Then(/The user "(.*?)"( should not)? exists/, async function (userId, shouldNot) {
  try {
    await this.sdk.security.getUser(userId);

    if (shouldNot) {
      throw new Error(`User "${userId}" should not exists.`);
    }
  }
  catch (error) {
    if (error.status === 404) {
      if (! shouldNot) {
        throw new Error(`User "${userId}" should exists.`);
      }
    }
    else {
      throw error;
    }
  }
});

Then('I am able to mGet users with the following ids:', async function (dataTable) {
  const userIds = _.flatten(dataTable.rawTable).map(JSON.parse);
  this.props.result = await this.sdk.security.mGetUsers(userIds);
});
