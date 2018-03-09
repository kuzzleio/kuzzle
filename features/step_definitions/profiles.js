const
  {
    Given,
    When,
    Then
  } = require('cucumber'),
  async = require('async');

When(/^I get the profile mapping$/, function () {
  return this.api.getProfileMapping()
    .then(response => {
      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.result) {
        throw new Error('No result provided');
      }

      if (!response.result.mapping) {
        throw new Error('No mapping provided');
      }

      this.result = response.result.mapping;
    });
});

Then(/^I change the profile mapping$/, function () {
  return this.api.updateProfileMapping()
    .then(body => {
      if (body.error !== null) {
        throw new Error(body.error.message);
      }
    });
});

When(/^I create a new profile "([^"]*)" with id "([^"]*)"$/, {timeout: 20 * 1000}, function (profile, id) {
  if (!this.profiles[profile]) {
    throw new Error('Fixture for profile ' + profile + ' does not exists');
  }

  id = this.idPrefix + id;

  return this.api.createOrReplaceProfile(id, this.profiles[profile])
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }
    });
});

Then(/^I cannot create an invalid profile$/, {timeout: 20 * 1000}, function (callback) {
  this.api.createOrReplaceProfile('invalid-profile', this.profiles.invalidProfile)
    .then(() => {
      callback(new Error('Creating profile with unexisting role succeeded. Expected to throw.'));
    })
    .catch(() => callback());
});

Then(/^I cannot create a profile with an empty set of roles$/, {timeout: 20 * 1000}, function (callback) {
  this.api.createOrReplaceProfile('invalid-profile', this.profiles.empty)
    .then(() => {
      callback(new Error('Creating profile without roles succeeded. Expected to throw.'));
    })
    .catch(() => callback());
});

Then(/^I cannot a profile without ID$/, function (callback) {
  this.api.getProfile('')
    .then(() => {
      callback(new Error('Getting profile without id succeeded. Expected to throw.'));
    })
    .catch(() => callback());
});

Then(/^I'm ?(not)* able to find the profile with id "([^"]*)"(?: with profile "([^"]*)")?$/, {timeout: 20 * 1000}, function (not, id, profile, callback) {
  if (profile && !this.profiles[profile]) {
    return callback(new Error('Fixture for profile ' + profile + ' not exists'));
  }

  id = this.idPrefix + id;

  let main = function (callbackAsync) {
    setTimeout(() => {
      this.api.getProfile(id)
        .then(body => {
          if (body.error) {
            return callbackAsync(new Error(body.error.message));
          }

          if (not) {
            return callbackAsync(new Error(`Profile with id ${id} exists`));
          }

          callbackAsync();
        })
        .catch(error => callback(not ? null : error));
    }, 20); // end setTimeout
  };

  async.retry(20, main.bind(this), function (err) {
    if (err) {
      return callback(err);
    }

    callback();
  });
});

Then(/^I'm ?(not)* able to find rights for profile "([^"]*)"$/, {timeout: 20 * 1000}, function (not, id) {
  id = this.idPrefix + id;

  return this.api.getProfileRights(id)
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }

      if (not) {
        throw new Error(`Profile with id ${id} exists`);
      }
    })
    .catch(err => {
      if (!not || err.statusCode !== 404) {
        return Promise.reject(err);
      }
    });
});

When(/^I delete the profile (?:with id )?"([^"]*)"$/, function (id) {
  if (id) {
    id = this.idPrefix + id;
  }

  return this.api.deleteProfile(id)
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }
    });
});

Then(/^I'm able to find "([\d]*)" profiles(?: containing the role with id "([^"]*)")?$/, function (profilesCount, roleId, callback) {
  const body = {roles: []};

  if (roleId) {
    body.roles.push(this.idPrefix + roleId);
  }

  let main = function (callbackAsync) {
    setTimeout(() => {
      this.api.searchProfiles(body)
        .then(response => {
          if (response.error) {
            return callbackAsync(new Error(response.error.message));
          }

          if (!response.result) {
            return callbackAsync(new Error('Malformed response (no error, no result)'));
          }

          if (!Array.isArray(response.result.hits)) {
            return callbackAsync(new Error('Malformed response (hits is not an array)'));
          }

          if (!response.result.hits) {
            response.result.hits = response.result.hits.filter(doc => doc._id.indexOf(this.idPrefix));

            if (response.result.hits.length !== parseInt(profilesCount)) {
              return callbackAsync(`Expected ${profilesCount} profiles. Got ${response.result.hits.length}`);
            }
          }

          callbackAsync();
        })
        .catch(err => callbackAsync(err));
    }, 200);
  };

  async.retry(20, main.bind(this), function (err) {
    if (err) {
      return callback(new Error(err));
    }

    callback();
  });
});

Given(/^I update the profile with id "([^"]*)" by adding the role "([^"]*)"$/, {timeout: 20 * 1000}, function (profileId, roleId) {
  if (!this.roles[roleId]) {
    throw new Error('Fixture for role ' + roleId + ' does not exists');
  }

  roleId = this.idPrefix + roleId;
  profileId = this.idPrefix + profileId;

  return this.api.createOrReplaceProfile(profileId, {policies: [{roleId: roleId}]})
    .then(response => {
      if (response.error) {
        throw new Error(response.error.message);
      }
    });
});

Then(/^I'm able to do a multi get with "([^"]*)" and get "(\d*)" profiles$/, function (profiles, count, callback) {
  let body = {
    ids: profiles.split(',').map(roleId => this.idPrefix + roleId)
  };

  let main = function (callbackAsync) {
    setTimeout(() => {
      this.api.mGetProfiles(body)
        .then(response => {
          if (response.error) {
            return callbackAsync(response.error.message);
          }

          if (!response.result.hits || response.result.hits.length !== parseInt(count)) {
            return callbackAsync('Expected ' + count + ' profiles, get ' + response.result.hits.length);
          }

          callbackAsync();
        })
        .catch(err => callbackAsync(err));
    }, 100); // end setTimeout
  };

  async.retry(20, main.bind(this), function (err) {
    if (err) {
      return callback(err);
    }

    callback();
  });
});

Given(/^A scrolled search on profiles$/, function () {
  this.scrollId = null;

  return this.api.searchProfiles({roles: []}, {scroll: '1m'})
    .then(response => {
      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.result.scrollId) {
        throw new Error('No scrollId returned by the searchProfile query');
      }

      this.scrollId = response.result.scrollId;
    });
});

Then(/^I am able to perform a scrollProfiles request$/, function () {
  if (!this.scrollId) {
    throw new Error('No previous scrollId found');
  }

  return this.api.scrollProfiles(this.scrollId)
    .then(response => {
      if (response.error) {
        throw new Error(response.error.message);
      }

      if (['hits', 'scrollId', 'total'].some(prop => response.result[prop] === undefined)) {
        throw new Error('Incomplete scroll results');
      }
    });
});

