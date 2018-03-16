const
  {
    When,
    Given,
    Then
  } = require('cucumber'),
  _ = require('lodash'),
  async = require('async');

When(/^I get the user mapping$/, function () {
  return this.api.getUserMapping()
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

Then(/^I change the user mapping$/, function () {
  return this.api.updateUserMapping()
    .then(body => {
      if (body.error !== null) {
        throw new Error(body.error.message);
      }
    });
});

When(/^I (can't )?create a (restricted )?user "(.*?)" with id "(.*?)"$/, {timeout: 20000}, function (not, isRestricted, user, id, callback) {
  var
    userObject = this.users[user],
    method;

  if (isRestricted) {
    method = 'createRestrictedUser';
  }
  else {
    method = 'createUser';
  }

  id = this.idPrefix + id;

  this.api[method](userObject, id)
    .then(body => {
      if (body.error) {
        if (not) {
          return callback();
        }
        return callback(new Error(body.error.message));
      }

      if (not) {
        return callback(new Error(JSON.stringify(body)));
      }
      return callback();
    })
    .catch(error => callback(not ? null : error));
});

Then(/^I am able to get the user "(.*?)"(?: matching {(.*)})?$/, function (id, match) {
  id = this.idPrefix + id;

  return this.api.getUser(id)
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }

      if (match) {
        match = match.replace(/#prefix#/g, this.idPrefix);

        const matchObject = JSON.parse('{' + match + '}');

        if (!_.matches(matchObject)(body.result)) {
          throw new Error('Error: ' + JSON.stringify(body.result) + ' does not match {' + match + '}');
        }
      }
    });
});

Then(/^I search for {(.*?)} and find (\d+) users(?: matching {(.*?)})?$/, function (query, count, match, callback) {
  if (count) {
    count = parseInt(count);
  }

  let run = (cb) => {
    query = query.replace(/#prefix#/g, this.idPrefix);

    this.api.searchUsers(JSON.parse('{' + query + '}'))
      .then(body => {
        if (body.error) {
          return cb(new Error(body.error.message));
        }

        if (count !== body.result.total) {
          return cb(new Error('Expected ' + count + ' results, got ' + body.result.total + '\n' + JSON.stringify(body.result.hits)));
        }

        if (match) {
          match = match.replace(/#prefix#/g, this.idPrefix);

          const matchFunc = _.matches(JSON.parse('{' + match + '}'));

          if (!body.result.hits.every(hit => matchFunc(hit))) {
            return cb(new Error('Error: ' + JSON.stringify(body.result.hits) + ' does not match ' + match));
          }
        }

        cb(null);
      })
      .catch(error => cb(error));
  };

  async.retry({times: 40, interval: 50}, run, err => {
    if (err) {
      return callback(new Error(err.message));
    }

    return callback();
  });
});

Then(/^I replace the user "(.*?)" with data {(.*?)}$/, function (id, data) {
  return this.api.replaceUser(this.idPrefix + id, JSON.parse('{' + data + '}'))
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }
    });
});

Then(/^I delete the user "(.*?)"$/, function (id) {
  return this.api.deleteUser(this.idPrefix + id, true)
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }
    });
});

Then(/^I am getting the current user, which matches \{(.*?)}$/, function (match) {
  return this.api.getCurrentUser()
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }

      match = match.replace(/#prefix#/g, this.idPrefix);
      if (!_.matches(JSON.parse('{' + match + '}'))(body.result)) {
        throw new Error('Expected: ' + match + '\nGot: ' + JSON.stringify(body.result));
      }
    });
});

Then(/^I'm ?(not)* able to find rights for user "([^"]*)"$/, function (not, id, callback) {
  id = this.idPrefix + id;

  this.api.getUserRights(id)
    .then(body => {
      if (body.error) {
        return callback(new Error(body.error.message));
      }

      if (not) {
        return callback(new Error(`User with id ${id} exists`));
      }

      callback();
    })
    .catch(error => callback(not ? null : error));
});

Then(/^I'm able to find my rights$/, function () {
  return this.api.getMyRights()
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }
    });
});

Given(/^A scrolled search on users$/, function () {
  this.scrollId = null;

  return this.api.searchUsers({}, {scroll: '1m'})
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

Then(/^I am able to perform a scrollUsers request$/, function () {
  if (!this.scrollId) {
    throw new Error('No previous scrollId found');
  }

  return this.api.scrollUsers(this.scrollId)
    .then(response => {
      if (response.error) {
        throw new Error(response.error.message);
      }

      if (['hits', 'scrollId', 'total'].some(prop => response.result[prop] === undefined)) {
        throw new Error('Incomplete scroll results');
      }
    });
});

