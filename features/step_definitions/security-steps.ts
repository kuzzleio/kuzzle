import _ from "lodash";
import should from "should";
import { Then } from "@cucumber/cucumber";

import { isApiError } from "../support/errors";
import type KuzzleWorld from "../support/world";
import { invokeAction } from "../support/invoke";

Then(
  /I (try to )?create a (strict )?profile "(.*?)" with the following policies:/,
  async function (this: KuzzleWorld, trying, strict, profileId, dataTable) {
    const data = this.parseObject(dataTable);
    const policies = [];

    this.props.error = null;

    for (const [roleId, restrictedTo] of Object.entries(data)) {
      policies.push({ restrictedTo, roleId });
    }

    try {
      if (!strict) {
        this.props.result = await this.sdk.security.createProfile(profileId, {
          policies,
        });
      } else {
        // @todo replace sdk.query once createProfile handles the new "strict" option
        this.props.result = await this.sdk.query({
          _id: profileId,
          action: "createProfile",
          body: { policies },
          controller: "security",
          strict: true,
        });
      }
    } catch (e) {
      if (trying) {
        this.props.error = e;
        return;
      }
      throw e;
    }
  },
);

Then(
  /I (can not )?"(.*?)" a role "(.*?)" with the following API rights:/,
  async function (this: KuzzleWorld, not, method, roleId, dataTable) {
    const controllers = this.parseObject(dataTable);
    const options = {
      force: not ? false : true,
    };

    await this.tryAction(
      invokeAction(
        this.sdk.security,
        method + "Role",
        roleId,
        { controllers },
        options,
      ),
      not,
    );
  },
);

Then(
  /I am (not )?able to get a role with id "(.*?)"/,
  function (this: KuzzleWorld, not, roleId) {
    return this.tryAction(this.sdk.security.getRole(roleId), not);
  },
);

Then(
  /I am (not )?able to get a profile with id "(.*?)"/,
  async function (this: KuzzleWorld, not, profileId) {
    return this.tryAction(
      this.sdk.security.getProfile(profileId),
      not,
      `Profile ${profileId} exists`,
    );
  },
);

Then(
  "I am able to find {int} roles by searching controller:",
  async function (this: KuzzleWorld, count, dataTable) {
    const controller = this.parseObject(dataTable);

    const result = await this.sdk.security.searchRoles(controller);

    result.hits.sort((a: { _id: string }, b: { _id: string }) =>
      a._id.localeCompare(b._id),
    );

    this.props.result = result;
  },
);

Then(
  "I am able to mGet roles and get {int} roles with the following ids:",
  async function (this: KuzzleWorld, count, dataTable) {
    const data = this.parseObject(dataTable);
    const roleIds = [];

    if (typeof data.ids !== "object" || data.ids === null) {
      throw new Error(`"ids" must be an object or an array, got ${data.ids}`);
    }

    for (const role of Object.values(data.ids)) {
      roleIds.push(role);
    }

    this.props.result = await this.sdk.security.mGetRoles(roleIds);
  },
);

Then(
  /I (can not )?delete the role "(.*?)"/,
  function (this: KuzzleWorld, not, roleId) {
    return this.tryAction(
      this.sdk.security.deleteRole(roleId, { refresh: "wait_for" }),
      not,
    );
  },
);

Then(
  /I (can not )?delete the profile "(.*?)"/,
  function (this: KuzzleWorld, not, profileId) {
    return this.tryAction(
      this.sdk.security.deleteProfile(profileId, { refresh: "wait_for" }),
      not,
    );
  },
);

Then("I delete the user {string}", async function (this: KuzzleWorld, userId) {
  this.props.result = await this.sdk.security.deleteUser(userId, {
    refresh: "wait_for",
  });
});

Then(
  "I create a user {string} with content:",
  async function (this: KuzzleWorld, userId, dataTable) {
    const content = this.parseObject(dataTable);

    const body = {
      content,
      credentials: {
        local: {
          password: "password",
          username: userId,
        },
      },
    };

    this.props.result = await this.sdk.security.createUser(userId, body, {
      refresh: "wait_for",
    });
  },
);

Then(
  "I update the role {string} with:",
  async function (this: KuzzleWorld, roleId, dataTable) {
    const controllers = this.parseObject(dataTable);

    const rights: Record<string, { actions: unknown }> = {};

    for (const [controller, actions] of Object.entries(controllers)) {
      rights[controller] = { actions };
    }

    this.props.result = await this.sdk.security.updateRole(
      roleId,
      { controllers: rights },
      { refresh: "wait_for" },
    );
  },
);

Then(
  "The role {string} should match the default one",
  async function (this: KuzzleWorld, roleId) {
    const defaultRoles = this.kuzzleConfig.security.standard.roles,
      role = await this.sdk.security.getRole(roleId);

    for (const [controller, actions] of Object.entries(role.controllers)) {
      should(actions).match(defaultRoles[roleId].controllers[controller]);
    }
  },
);

Then(
  "The role {string} should match:",
  async function (this: KuzzleWorld, roleId, dataTable) {
    const controllers = this.parseObject(dataTable);
    const role = await this.sdk.security.getRole(roleId);

    for (const [controller, actions] of Object.entries(controllers)) {
      should(role.controllers).have.property(controller);
      should(actions).match(role.controllers[controller].actions);
    }
  },
);

Then(
  "The profile {string} policies should match:",
  async function (this: KuzzleWorld, profileId, dataTable) {
    const expectedPolicies = this.parseObjectArray(dataTable);

    const profile = await this.sdk.security.getProfile(profileId);

    should(profile.policies).have.length(expectedPolicies.length);

    for (let i = 0; i < profile.policies.length; i++) {
      should(profile.policies[i]).match(expectedPolicies[i]);
    }
  },
);

Then(
  "The user {string} should have the following profiles:",
  async function (this: KuzzleWorld, userId, dataTable) {
    const expectedProfiles = _.flatten(dataTable.rawTable);

    const user = await this.sdk.security.getUser(userId);

    should(user.profileIds).be.eql(expectedProfiles);
  },
);

Then(
  /The user "(.*?)"( should not)? exists/,
  async function (this: KuzzleWorld, userId, shouldNot) {
    try {
      await this.sdk.security.getUser(userId);

      if (shouldNot) {
        throw new Error(`User "${userId}" should not exists.`);
      }
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        if (!shouldNot) {
          throw new Error(`User "${userId}" should exists.`, { cause: error });
        }
      } else {
        throw error;
      }
    }
  },
);

Then(
  "I am able to mGet users with the following ids:",
  async function (this: KuzzleWorld, dataTable) {
    const userIds = _.flatten(dataTable.rawTable).map((obj: any) =>
      JSON.parse(obj),
    );
    this.props.result = await this.sdk.security.mGetUsers(userIds);
  },
);
