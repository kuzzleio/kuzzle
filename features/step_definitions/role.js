var
  async = require('async');

var apiSteps = function () {
  this.When(/^I get the role mapping$/, function (callback) {
    this.api.getRoleMapping()
      .then(function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        if (!response.result.mapping) {
          return callback(new Error('No mapping provided'));
        }

        this.result = response.result.mapping;
        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I change the role mapping$/, function (callback) {
    this.api.updateRoleMapping()
      .then(body => {
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

  this.When(/^I create a new role "([^"]*)" with id "([^"]*)"$/, function (role, id, callback) {
    if (!this.roles[role]) {
      return callback('Fixture for role ' + role + ' does not exist');
    }
    id = this.idPrefix + id;

    this.api.createOrReplaceRole(id, this.roles[role])
      .then(body => {
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

  this.Then(/^I'm ?(not)* able to find a role with id "([^"]*)"(?: equivalent to role "([^"]*)")?$/, function (not, id, role, callback) {
    var
      controller,
      main;

    id = this.idPrefix + id;

    if (role && !this.roles[role]) {
      return callback('Fixture for role ' + role + ' not exists');
    }

    main = function (callbackAsync) {
      setTimeout(() => {
        this.api.getRole(id)
          .then(body => {
            if (body.error) {
              return callbackAsync(body.error.message);
            }

            if (!body.result) {
              if (not) {
                return callbackAsync();
              }

              return callbackAsync('No result provided');
            }

            if (not) {
              return callbackAsync(`Role with id ${id} exists`);
            }

            if (role) {
              controller = Object.keys(this.roles[role].controllers)[0];
              if (!body.result._source.controllers[controller]) {
                if (not) {
                  return callbackAsync();
                }

                return callbackAsync(`Could not find role ${id}`);
              }
            }

            callbackAsync();
          })
          .catch(error => {
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
  });

  this.When(/^I update the role "([^"]*)" with the test content "([^"]*)"$/, function (id, role, callback) {
    if (!this.roles[role]) {
      return callback('Fixture for role ' + role + ' not exists');
    }
    id = this.idPrefix + id;

    this.api.createOrReplaceRole(id, this.roles[role])
      .then(body => {
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

  this.Then(/^I'm able to find "(\d*)" role by searching controller "([^"]*)"(?: from "([^"]*)" to "([^"]*)")?$/, function (count, controller, from, size, callback) {
    var
      main,
      body;

    body = {
      controllers : controller.split(','),
      from: from || 0,
      size: size || 999
    };

    main = function (callbackAsync) {
      setTimeout(() => {
        this.api.searchRoles(body)
          .then(aBody => {
            if (aBody.error) {
              callbackAsync(aBody.error.message);
              return false;
            }

            if (!aBody.result.hits) {
              return callbackAsync('Expected ' + count + ' roles, get 0');
            }

            if (aBody.result.hits.length !== parseInt(count)) {
              return callbackAsync('Expected ' + count + ' roles, get ' + aBody.result.hits.length);
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
  });

  this.When(/^I delete the role (?:with id )?"([^"]*)"$/, function (id, callback) {
    id = this.idPrefix + id;

    this.api.deleteRole(id)
      .then(body => {
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

  this.Then(/^I'm able to do a multi get with "([^"]*)" and get "(\d*)" roles$/, function (roles, count, callback) {
    var
      main,
      body;

    body = {
      ids: roles.split(',').map(roleId => this.idPrefix + roleId)
    };

    main = function (callbackAsync) {
      setTimeout(() => {
        this.api.mGetRoles(body)
          .then(response => {
            if (response.error) {
              callbackAsync(response.error.message);
              return false;
            }

            if (!response.result.hits || response.result.hits.length !== parseInt(count)) {
              return callbackAsync('Expected ' + count + ' roles, get ' + response.result.hits.length);
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
  });

  this.Then(/^I'm ?(not)* allowed to create a document in index "([^"]*)" and collection "([^"]*)"$/, function (not, index, collection, callback) {
    var
      document = this.documentGrace;

    this.api.create(document, index, collection)
      .then(body => {
        if (not && body.status === 403) {
          callback();
          return true;
        }
        if (not) {
          callback(new Error('Unexpected status response. Got ' + body.status + ' ; Expected 403'));
          return false;
        }
        if (body.status === 200) {
          callback();
          return true;
        }
        callback(new Error('Unexpected status response. Got ' + body.status + ' ; Expected 200'));
      })
      .catch(error => {
        if (not && error.statusCode === 403) {
          callback();
          return true;
        }
        callback(error);
      });
  });

  this.Then(/^I'm ?(not)* allowed to search for documents in index "([^"]*)" and collection "([^"]*)"$/, function (not, index, collection, callback) {
    this.api.search({}, index, collection)
      .then(body => {
        if (not) {
          callback(new Error('Unexpected status response. Got ' + body.status + ' ; Expected 403'));
          return false;
        }
        if (body.status === 200) {
          callback();
          return true;
        }
        callback(new Error('Unexpected status response. Got ' + body.status + ' ; Expected 200'));
      })
      .catch(error => {
        if (not && error.statusCode === 403) {
          callback();
          return true;
        }
        callback(error);
      });
  });

  this.Then(/^I'm ?(not)* allowed to count documents in index "([^"]*)" and collection "([^"]*)"$/, function (not, index, collection, callback) {
    this.api.count({}, index, collection)
      .then(body => {
        if (not) {
          callback(new Error('Unexpected status response. Got ' + body.status + ' ; Expected 403'));
          return false;
        }
        if (body.status === 200) {
          callback();
          return true;
        }
        callback(new Error('Unexpected status response. Got ' + body.status + ' ; Expected 200'));
      })
      .catch(error => {
        if (not && error.statusCode === 403) {
          callback();
          return true;
        }
        callback(error);
      });
  });
};

module.exports = apiSteps;
