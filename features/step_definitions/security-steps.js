'use strict';

const should = require('should');
const { Then } = require('cucumber');

Then(/I (try to )?create a (strict )?profile "(.*?)" with the following policies:/, async function (trying, strict, profileId, dataTable) {
  const data = this.parseObject(dataTable);
  const policies = [];

  this.props.error = null;

  for (const [roleId, restrictedTo] of Object.entries(data)) {
    policies.push({ roleId, restrictedTo });
  }

  try {
    if (!strict) {
      this.props.result = await this.sdk.security.createProfile(profileId, {
        policies,
      });
    }
    else {
      // @todo replace sdk.query once createProfile handles the new "strict" option
      this.props.result = await this.sdk.query({
        controller: 'security',
        action: 'createProfile',
        _id: profileId,
        body: { policies },
        strict: true,
      });
    }
  }
  catch (e) {
    if (trying) {
      this.props.error = e;
      return;
    }
    throw e;
  }
});

Then(/I (can not )?"(.*?)" a role "(.*?)" with the following API rights:/, async function (not, method, roleId, dataTable) {
  const controllers = this.parseObject(dataTable);
  const options = {
    force: not ? false : true
  };

  await this.tryAction(
    this.sdk.security[method + 'Role'](roleId, { controllers }, options),
    not);
});

Then(/I am (not )?able to get a role with id "(.*?)"/, function (not, roleId) {
  return this.tryAction(this.sdk.security.getRole(roleId), not);
});

Then(/I am (not )?able to get a profile with id "(.*?)"/, async function (not, profileId) {
  return this.tryAction(this.sdk.security.getProfile(profileId), not, `Profile ${profileId} exists`);
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

Then(/I (can not )?delete the role "(.*?)"/, function (not, roleId) {
  return this.tryAction(
    this.sdk.security.deleteRole(roleId, { refresh: 'wait_for' }),
    not);
});

Then(/I (can not )?delete the profile "(.*?)"/, function (not, profileId) {
  return this.tryAction(
    this.sdk.security.deleteProfile(profileId, { refresh: 'wait_for' }),
    not);
});

Then('I update the role {string} with:', async function (roleId, dataTable) {
  const controllers = this.parseObject(dataTable);

  const rights = {};

  for (const [controller, actions] of Object.entries(controllers)) {
    rights[controller] = { actions };
  }

  this.props.result = await this.sdk.security.updateRole(roleId, { controllers: rights }, { refresh: 'wait_for' });
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
  const controllers = this.parseObject(dataTable);
  const role = await this.sdk.security.getRole(roleId);

  for (const [controller, actions] of Object.entries(controllers)) {
    should(role.controllers).have.property(controller);
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

