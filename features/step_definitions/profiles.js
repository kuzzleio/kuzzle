var
  async = require('async');

var apiSteps = function () {
  this.When(/^I create a new profile "([^"]*)" with id "([^"]*)"$/, {timeout: 20 * 1000}, function (profile, id, callback) {
    if (!this.profiles[profile]) {
      return callback('Fixture for profile ' + profile + ' does not exists');
    }

    id = this.idPrefix + id;

    this.api.createOrReplaceProfile(id, this.profiles[profile])
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

  this.Then(/^I cannot create an invalid profile$/, {timeout: 20 * 1000}, function (callback) {
    this.api.createOrReplaceProfile('invalid-profile', this.profiles.invalidProfile)
      .then(function (body) {
        if (body.error) {
          callback();
          return true;
        }

        callback(new Error('Creating profile with unexisting role succeeded. Expected to throw.'));
      }.bind(this))
      .catch(function (error) {
        callback();
      });
  });

  this.Then(/^I cannot create a profile with an empty set of roles$/, {timeout: 20 * 1000}, function (callback) {
    this.api.createOrReplaceProfile('invalid-profile', this.profiles.empty)
      .then(function (body) {
        if (body.error) {
          callback();
          return true;
        }

        callback(new Error('Creating profile without roles succeeded. Expected to throw.'));
      }.bind(this))
      .catch(function (error) {
        callback();
      });
  });

  this.Then(/^I cannot a profile without ID$/, function (callback) {
    this.api.getProfile('')
      .then(body => {
        if (body.error) {
          callback();
          return true;
        }

        callback(new Error('Getting profile without id succeeded. Expected to throw.'));
      })
      .catch(error => {
        callback();
      });
  });


  this.Then(/^I'm ?(not)* able to find the profile with id "([^"]*)"(?: with profile "([^"]*)")?$/, {timeout: 20 * 1000}, function (not, id, profile, callback) {
    var
      main;

    if (profile && !this.profiles[profile]) {
      return callback('Fixture for profile ' + profile + ' not exists');
    }

    id = this.idPrefix + id;

    main = function (callbackAsync) {
      setTimeout(() => {
        this.api.getProfile(id)
          .then(body => {
            if (body.error) {
              return callbackAsync(body.error.message);
            }

            if (not) {
              return callbackAsync(`Profile with id ${id} exists`);
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

  this.Then(/^I'm ?(not)* able to find rights for profile "([^"]*)"$/, {timeout: 20 * 1000}, function (not, id, callback) {
    id = this.idPrefix + id;

    this.api.getProfileRights(id)
      .then(body => {
        if (body.error) {
          return callback(body.error.message);
        }

        if (not) {
          return callback(`Profile with id ${id} exists`);
        }

        callback();
      })
      .catch(error => {
        if (not) {
          return callback();
        }

        callback(error);
      });

  });

  this.When(/^I delete the profile (?:with id )?"([^"]*)"$/, function (id, callback) {
    if (id) {
      id = this.idPrefix + id;
    }

    this.api.deleteProfile(id)
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

  this.Then(/^I'm able to find "([\d]*)" profiles(?: containing the role with id "([^"]*)")?$/, function (profilesCount, roleId, callback) {
    var body = {
        roles: []
      },
      main;

    if (roleId) {
      body.roles.push(this.idPrefix + roleId);
    }

    main = function (callbackAsync) {
      setTimeout(() => {

        this.api.searchProfiles(body).then(response => {

          if (response.error) {
            callbackAsync(new Error(response.error.message));
            return false;
          }

          if (!response.result) {
            callbackAsync(new Error('Malformed response (no error, no result)'));
            return false;
          }

          if (!Array.isArray(response.result.hits)) {
            callbackAsync(new Error('Malformed response (hits is not an array)'));
            return false;
          }

          if (!response.result.hits) {
            response.result.hits = response.result.hits.filter(doc => doc._id.indexOf(this.idPrefix));

            if (response.result.hits.length !== parseInt(profilesCount)) {
              return callbackAsync(`Expected ${profilesCount} profiles. Got ${response.result.hits.length}`);
            }
          }

          callbackAsync();
        })
        .catch(function (error) {
          callbackAsync(error);
        });
      }, 200);
    };

    async.retry(20, main.bind(this), function (err) {
      if (err) {
        callback(new Error(err));
        return false;
      }

      callback();
    });
  });

  this.Given(/^I update the profile with id "([^"]*)" by adding the role "([^"]*)"$/, {timeout: 20 * 1000}, function (profileId, roleId, callback) {
    if (!this.roles[roleId]) {
      return callback('Fixture for role ' + roleId + ' does not exists');
    }
    roleId = this.idPrefix + roleId;
    profileId = this.idPrefix + profileId;

    this.api.createOrReplaceProfile(profileId, {
      roles: [roleId]
    })
    .then(response => {
      if (response.error) {
        callback(new Error(response.error.message));
        return false;
      }

      callback();
    })
    .catch(function (error) {
      callback(error);
    });
  });

  this.Then(/^I'm able to do a multi get with "([^"]*)" and get "(\d*)" profiles$/, function (profiles, count, callback) {
    var
      main,
      body;

    body = {
      ids: profiles.split(',').map(roleId => this.idPrefix + roleId)
    };

    main = function (callbackAsync) {
      setTimeout(() => {
        this.api.mGetProfiles(body)
          .then(response => {
            if (response.error) {
              callbackAsync(response.error.message);
              return false;
            }

            if (!response.result.hits || response.result.hits.length !== parseInt(count)) {
              return callbackAsync('Expected ' + count + ' profiles, get ' + response.result.hits.length);
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
