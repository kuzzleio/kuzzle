var
  async = require('async');

var apiSteps = function () {
  this.When(/^I create a new role "([^"]*)" with id "([^"]*)"$/, function (role, id, callback) {
    if (!this.roles[role]) {
      return callback('Fixture for role ' + role + ' does not exist');
    }
    id = this.idPrefix + id;

    this.api.createOrReplaceRole(id, this.roles[role])
      .then(function (body) {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error);
      });
  });

  this.Then(/^I'm ?(not)* able to find a role with id "([^"]*)"(?: with role "([^"]*)")?$/, function (not, id, role, callback) {
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

                return callbackAsync('The role hasn\'t right for index ' + index);
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

  this.When(/^I update the role with id "([^"]*)" with role "([^"]*)"$/, function (id, role, callback) {
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

  this.Then(/^I'm able to find "(\d*)" role by searching controller corresponding to role "([^"]*)"(?: from "([^"]*)" to "([^"]*)")?$/, function (count, role, from, size, callback) {
    var
      main,
      controller,
      body;

    if (!this.roles[role]) {
      return callback('Fixture for role ' + role + ' does not exist');
    }

    index = Object.keys(this.roles[role].controllers)[0];
    body = {
      controllers : [controller],
      from: from || 0,
      size: size || 999
    };

    main = function (callbackAsync) {
      setTimeout(() => {
        this.api.searchRoles(body)
          .then(body => {
            if (body.error) {
              callbackAsync(body.error.message);
              return false;
            }

            if (!body.result.hits) {
              body.result.hits = body.result.hits.filter(doc => doc._id.indexOf(this.idPrefix));

              if (body.result.hits.length !== parseInt(count)) {
                return callbackAsync('Expected ' + count + ' roles, get ' + body.result.hits.length);
              }
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
};

module.exports = apiSteps;
