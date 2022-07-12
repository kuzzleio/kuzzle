"use strict";

const { When, Then } = require("cucumber"),
  async = require("async");

When(/^I get the role mapping$/, function (callback) {
  this.api
    .getRoleMapping()
    .then(
      function (response) {
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
      }.bind(this)
    )
    .catch(function (error) {
      callback(error);
    });
});

Then(/^I change the role mapping$/, function (callback) {
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
  function (role, id, callback) {
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
  }
);

Then(
  /^I'm ?(not)* able to find a ?(default)* (role|profile|user) with id "([^"]*)"(?: equivalent to (role|profile|user) "([^"]*)")?$/,
  function (not, _default, objectType, id, objectType2, object, callback) {
    let controller, main;

    const objectTypeCapitalized =
      objectType.charAt(0).toUpperCase() + objectType.slice(1);

    if (!_default) {
      id = this.idPrefix + id;
    }

    if (object && !this[`${objectType}s`][object]) {
      return callback(`Fixture for ${objectType} ${object} not exists`);
    }

    main = function (callbackAsync) {
      setTimeout(() => {
        const method = `get${objectTypeCapitalized}`;

        this.api[method]
          .apply(this.api, [id]) // eslint-disable-line no-useless-call
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
                `${objectTypeCapitalized} with id ${id} exists`
              );
            }

            if (object) {
              controller = Object.keys(
                this[`${objectType}s`][object].controllers
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

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback(new Error(err));
        return false;
      }

      callback();
    });
  }
);

When(
  /^I update the role "([^"]*)" with the test content "([^"]*)"$/,
  function (id, role, callback) {
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
  }
);

Then(
  /^I'm able to find "(\d*)" role by searching controller "([^"]*)"(?: with maximum "([^"]*)" results starting from "([^"]*)")?$/,
  function (count, controller, size, from, callback) {
    var main,
      body = {
        controllers: controller.split(","),
      },
      args = {
        from: from || 0,
        size: size || 999,
      };

    main = function (callbackAsync) {
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
                "Expected " + count + " roles, got " + aBody.result.hits.length
              );
            }

            callbackAsync();
          })
          .catch(function (error) {
            callbackAsync(error);
          });
      }, 100); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback(new Error(err));
        return false;
      }

      callback();
    });
  }
);

When(/^I delete the role (?:with id )?"([^"]*)"$/, function (id, callback) {
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
});

Then(
  /^I'm able to do a multi get with "([^"]*)" and get "(\d*)" roles$/,
  function (roles, count, callback) {
    var main, body;

    body = {
      ids: roles.split(",").map((roleId) => this.idPrefix + roleId),
    };

    main = function (callbackAsync) {
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
                  response.result.hits.length
              );
            }

            callbackAsync();
          })
          .catch(function (error) {
            callbackAsync(error);
          });
      }, 100); // end setTimeout
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback(new Error(err));
        return false;
      }

      callback();
    });
  }
);

Then(
  /^I'm ?(not)* allowed to create a document in index "([^"]*)" and collection "([^"]*)"$/,
  async function (not, index, collection) {
    const document = this.documentGrace;
    let body;

    try {
      body = await this.api.create(document, index, collection);
    } catch (error) {
      if (not && error.statusCode === 403) {
        return;
      }
      throw error;
    }

    if (not) {
      throw new Error(
        `Unexpected status response. Got ${body.status}; Expected 403`
      );
    }

    if (body.status === 200) {
      return true;
    }

    throw new Error(
      `Unexpected status response. Got ${body.status}; Expected 200`
    );
  }
);

Then(
  /^I'm ?(not)* allowed to search for documents in index "([^"]*)" and collection "([^"]*)"$/,
  function (not, index, collection, callback) {
    this.api
      .search({}, index, collection)
      .then((body) => {
        if (not) {
          callback(
            new Error(
              "Unexpected status response. Got " +
                body.status +
                " ; Expected 403"
            )
          );
          return false;
        }
        if (body.status === 200) {
          callback();
          return true;
        }
        callback(
          new Error(
            "Unexpected status response. Got " + body.status + " ; Expected 200"
          )
        );
      })
      .catch((error) => {
        if (not && error.statusCode === 403) {
          callback();
          return true;
        }
        callback(error);
      });
  }
);

Then(
  /^I'm ?(not)* allowed to count documents in index "([^"]*)" and collection "([^"]*)"$/,
  function (not, index, collection, callback) {
    this.api
      .count({}, index, collection)
      .then((body) => {
        if (not) {
          callback(
            new Error(
              "Unexpected status response. Got " +
                body.status +
                " ; Expected 403"
            )
          );
          return false;
        }
        if (body.status === 200) {
          callback();
          return true;
        }
        callback(
          new Error(
            "Unexpected status response. Got " + body.status + " ; Expected 200"
          )
        );
      })
      .catch((error) => {
        if (not && error.statusCode === 403) {
          callback();
          return true;
        }
        callback(error);
      });
  }
);
