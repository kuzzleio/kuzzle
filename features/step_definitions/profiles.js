var
  async = require('async');

var apiSteps = function () {
  this.When(/^I create a new profile "([^"]*)" with id "([^"]*)"$/, {timeout: 20 * 1000}, function (profile, id, callback) {
    if (!this.profiles[profile]) {
      return callback('Fixture for profile ' + profile + ' does not exists');
    }

    this.api.putProfile(id, this.profiles[profile])
      .then(function (body) {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      }.bind(this))
      .catch(function (error) {
        callback(error.error.error.message);
      });
  });

  this.Then(/^I cannot create an invalid profile$/, {timeout: 120 * 1000}, function (callback) {
    this.api.putProfile('invalid-profile', this.profiles.invalidProfile)
      .then(function (body) {
        if (body.error) {
          callback();
          return true;
        }

        callback(new Error("Creating profile with unexisting role succeeded. Expected to throw."));
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

        callback(new Error("Getting profile without id succeeded. Expected to throw."));
      })
      .catch(error => {
        callback();
      })
  });


  this.Then(/^I'm ?(not)* able to find the profile with id "([^"]*)"(?: with profile "([^"]*)")?$/, function (not, id, profile, callback) {
    var
      index,
      main;

    if (profile && !this.profiles[profile]) {
      return callback('Fixture for profile ' + profile + ' not exists');
    }

    main = function (callbackAsync) {
      setTimeout(() => {
        this.api.getProfile(id)
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

            if (!body.result._source.roles) {
              if (not) {
                return callbackAsync();
              }

              return callbackAsync('Profile with id '+ id + ' exists');
            }

            callbackAsync();
          })
          .catch(error => {
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

  this.When(/^I delete the profile with id "([^"]*)"$/, function (id, callback) {
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

  this.Then(/^I'm able to find "([^"]*)" profiles(?: containing the role with id "([^"]*)")?$/, {timeout: 20 * 1000}, function (profilesCount, roleId, callback) {
    var body = {
        roles: []
      },
      main;

    if (roleId)
      body.roles.push(roleId);

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

          if (!response.result._source) {
            callbackAsync(new Error('Malformed response (no error, no _source)'));
            return false;
          }

          if (!Array.isArray(response.result._source)) {
            callbackAsync(new Error('Malformed response (_source is not an array)'));
            return false;
          }

          if (response.result._source.length != parseInt(profilesCount)) {
            callbackAsync(new Error('Expected ' + profilesCount + ' profiles. Got ' + response.result._source.length));
            return false;
          }

          callbackAsync();
        })
        .catch(function (error) {
          callbackAsync(error.error.error.message);
        });
      }, 2000);
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

    this.api.putProfile(profileId, {
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
      callback(error.error.error.message);
    });
  });
};

module.exports = apiSteps;
