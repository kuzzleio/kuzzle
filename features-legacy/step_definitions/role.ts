import { When, Then } from "@cucumber/cucumber";
import async from "async";
import {
  apiErrorStatus,
  asError,
  type AsyncCallback,
  type RetryFailure,
} from "../support/stepUtils";
import type { JSONObject } from "kuzzle-sdk";

/** The three security objects the "able to find a ..." steps are written for. */
type SecurityObjectType = "profile" | "role" | "user";

import type KWorld from "../support/world";

When(/^I get the role mapping$/, function (this: KWorld, callback) {
  this.api
    .getRoleMapping()
    .then(
      function (this: KWorld, response: JSONObject) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error("No result provided"));
        }

        if (!response.result.mapping) {
          return callback(new Error("No mapping provided"));
        }

        this.result = response.result.mapping;
        callback();
      }.bind(this),
    )
    .catch(function (error) {
      callback(error);
    });
});

Then(/^I change the role mapping$/, function (this: KWorld, callback) {
  this.api
    .updateRoleMapping()
    .then((body) => {
      if (body.error !== null) {
        callback(new Error(body.error.message));
        return false;
      }

      callback();
    })
    .catch(function (error) {
      callback(new Error(error));
    });
});

When(
  /^I create a new role "([^"]*)" with id "([^"]*)"$/,
  function (this: KWorld, role, id, callback) {
    if (!this.roles[role]) {
      return callback("Fixture for role " + role + " does not exist");
    }
    id = this.idPrefix + id;

    this.api
      .createOrReplaceRole(id, this.roles[role])
      .then((body) => {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  },
);

Then(
  /^I'm ?(not)* able to find a ?(default)* (role|profile|user) with id "([^"]*)"(?: equivalent to (role|profile|user) "([^"]*)")?$/,
  function (
    this: KWorld,
    not,
    _default,
    objectType: SecurityObjectType,
    id,
    objectType2,
    object,
    callback,
  ) {
    const objectTypeCapitalized =
      objectType.charAt(0).toUpperCase() + objectType.slice(1);

    // The regex offers three alternatives and the step used to turn each one
    // into a property name — `this[`${objectType}s`]`, `get${Capitalized}` —
    // which is three names the type system cannot check against a world and an
    // API that have hundreds.
    const fixtures: Record<SecurityObjectType, JSONObject> = {
      profile: this.profiles,
      role: this.roles,
      user: this.users,
    };
    const getById: Record<
      SecurityObjectType,
      (objectId: string) => Promise<JSONObject>
    > = {
      profile: (objectId) => this.api.getProfile(objectId),
      role: (objectId) => this.api.getRole(objectId),
      user: (objectId) => this.api.getUser(objectId),
    };

    if (!_default) {
      id = this.idPrefix + id;
    }

    if (object && !fixtures[objectType][object]) {
      return callback(`Fixture for ${objectType} ${object} not exists`);
    }

    const main = function (this: KWorld, callbackAsync: AsyncCallback) {
      setTimeout(() => {
        getById[objectType](id)
          .then((body) => {
            if (body.error) {
              return callbackAsync(body.error.message);
            }

            if (!body.result) {
              if (not) {
                return callbackAsync();
              }

              return callbackAsync("No result provided");
            }

            if (not) {
              return callbackAsync(
                `${objectTypeCapitalized} with id ${id} exists`,
              );
            }

            if (object) {
              const controller = Object.keys(
                fixtures[objectType][object].controllers,
              )[0];
              if (!body.result._source.controllers[controller]) {
                return callbackAsync(`Could not find ${objectType} ${id}`);
              }
            }

            callbackAsync();
          })
          .catch((error) => {
            if (not) {
              return callback();
            }

            callback(error);
          });
      }, 20); // end setTimeout
    };

    async.retry<void, RetryFailure>(20, main.bind(this), (failure) => {
      if (failure) {
        callback(asError(failure));
        return;
      }

      callback();
    });
  },
);

When(
  /^I update the role "([^"]*)" with the test content "([^"]*)"$/,
  function (this: KWorld, id, role, callback) {
    if (!this.roles[role]) {
      return callback("Fixture for role " + role + " not exists");
    }
    id = this.idPrefix + id;

    this.api
      .createOrReplaceRole(id, this.roles[role])
      .then((body) => {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  },
);

Then(
  /^I'm able to find "(\d*)" role by searching controller "([^"]*)"(?: with maximum "([^"]*)" results starting from "([^"]*)")?$/,
  function (this: KWorld, count, controller, size, from, callback) {
    const body = {
        controllers: controller.split(","),
      },
      args = {
        from: from || 0,
        size: size || 999,
      };

    const main = function (this: KWorld, callbackAsync: AsyncCallback) {
      setTimeout(() => {
        this.api
          .searchRoles(body, args)
          .then((aBody) => {
            if (aBody.error) {
              callbackAsync(aBody.error.message);
              return false;
            }

            if (!aBody.result.hits) {
              return callbackAsync("Expected " + count + " roles, got 0");
            }

            if (aBody.result.hits.length !== parseInt(count)) {
              return callbackAsync(
                "Expected " + count + " roles, got " + aBody.result.hits.length,
              );
            }

            callbackAsync();
          })
          .catch(function (error) {
            callbackAsync(error);
          });
      }, 100); // end setTimeout
    };

    async.retry<void, RetryFailure>(20, main.bind(this), (failure) => {
      if (failure) {
        callback(asError(failure));
        return;
      }

      callback();
    });
  },
);

When(
  /^I delete the role (?:with id )?"([^"]*)"$/,
  function (this: KWorld, id, callback) {
    id = this.idPrefix + id;

    this.api
      .deleteRole(id)
      .then((body) => {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  },
);

Then(
  /^I'm able to do a multi get with "([^"]*)" and get "(\d*)" roles$/,
  function (this: KWorld, roles, count, callback) {
    const body = {
      ids: roles.split(",").map((roleId: string) => this.idPrefix + roleId),
    };

    const main = function (this: KWorld, callbackAsync: AsyncCallback) {
      setTimeout(() => {
        this.api
          .mGetRoles(body)
          .then((response) => {
            if (response.error) {
              callbackAsync(response.error.message);
              return false;
            }

            if (
              !response.result.hits ||
              response.result.hits.length !== parseInt(count)
            ) {
              return callbackAsync(
                "Expected " +
                  count +
                  " roles, get " +
                  response.result.hits.length,
              );
            }

            callbackAsync();
          })
          .catch(function (error) {
            callbackAsync(error);
          });
      }, 100); // end setTimeout
    };

    async.retry<void, RetryFailure>(20, main.bind(this), (failure) => {
      if (failure) {
        callback(asError(failure));
        return;
      }

      callback();
    });
  },
);

Then(
  /^I'm ?(not)* allowed to create a document in index "([^"]*)" and collection "([^"]*)"$/,
  async function (this: KWorld, not, index, collection) {
    const document = this.documentGrace;
    let body;

    try {
      body = await this.api.create(document, index, collection);
    } catch (error) {
      if (not && apiErrorStatus(error) === 403) {
        return;
      }
      throw error;
    }

    if (not) {
      throw new Error(
        `Unexpected status response. Got ${body.status}; Expected 403`,
      );
    }

    if (body.status === 200) {
      return true;
    }

    throw new Error(
      `Unexpected status response. Got ${body.status}; Expected 200`,
    );
  },
);

Then(
  /^I'm ?(not)* allowed to search for documents in index "([^"]*)" and collection "([^"]*)"$/,
  function (this: KWorld, not, index, collection, callback) {
    this.api
      .search({}, index, collection)
      .then((body) => {
        if (not) {
          callback(
            new Error(
              "Unexpected status response. Got " +
                body.status +
                " ; Expected 403",
            ),
          );
          return false;
        }
        if (body.status === 200) {
          callback();
          return true;
        }
        callback(
          new Error(
            "Unexpected status response. Got " +
              body.status +
              " ; Expected 200",
          ),
        );
      })
      .catch((error) => {
        if (not && apiErrorStatus(error) === 403) {
          callback();
          return true;
        }
        callback(error);
      });
  },
);

Then(
  /^I'm ?(not)* allowed to count documents in index "([^"]*)" and collection "([^"]*)"$/,
  function (this: KWorld, not, index, collection, callback) {
    this.api
      .count({}, index, collection)
      .then((body) => {
        if (not) {
          callback(
            new Error(
              "Unexpected status response. Got " +
                body.status +
                " ; Expected 403",
            ),
          );
          return false;
        }
        if (body.status === 200) {
          callback();
          return true;
        }
        callback(
          new Error(
            "Unexpected status response. Got " +
              body.status +
              " ; Expected 200",
          ),
        );
      })
      .catch((error) => {
        if (not && apiErrorStatus(error) === 403) {
          callback();
          return true;
        }
        callback(error);
      });
  },
);
