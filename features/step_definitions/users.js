var
  _ = require('lodash'),
  async = require('async');

module.exports = function () {
  this.When(/^I (can't )?create a (new )?user "(.*?)" with id "(.*?)"$/, {timeout: 20000}, function (not, isNew, user, id, callback) {
    var
      userObject = this.users[user],
      method = isNew ? 'createUser' : 'createOrReplaceUser';

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
          return callback(new Error());
        }
        return callback();
      })
      .catch(function (error) {
        if (not) {
          return callback();
        }
        else {
          callback(error);
        }
      });
  });

  this.Then(/^I am able to get the user "(.*?)"(?: matching {(.*)})?$/, function (id, match, callback) {
    id = this.idPrefix + id;

    this.api.getUser(id)
      .then(body => {
        var
          matchObject;

        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        if (match) {
          match = match.replace(/#prefix#/g, this.idPrefix);
          matchObject = JSON.parse('{' + match + '}');
          if (!_.matches(matchObject)(body.result)) {
            return callback(new Error('Error: ' + JSON.stringify(body.result) + ' does not match ' + match));
          }
        }

        callback();
      })
      .catch(error => { callback(error); });
  });

  this.Then(/^I search for {(.*?)} and find (\d+) users(?: matching {(.*?)})?$/, function (filter, count, match, callback) {
    var run;

    if (count) {
      count = parseInt(count);
    }

    run = (cb) => {
      filter = filter.replace(/#prefix#/g, this.idPrefix);

      this.api.searchUsers(JSON.parse('{' + filter + '}'))
        .then(body => {
          var matchFunc;

          if (body.error) {
            return cb(new Error(body.error.message));
          }

          if (count !== body.result.total) {
            return cb(new Error('Expected ' + count + ' results, got ' + body.result.total + '\n' + JSON.stringify(body.result.hits)));
          }

          if (match) {
            match = match.replace(/#prefix#/g, this.idPrefix);
            matchFunc = _.matches(JSON.parse('{' + match + '}'));
            if (!body.result.hits.every(hit => {
                return matchFunc(hit);
              })) {
              return cb(new Error('Error: ' + JSON.stringify(body.result.hits) + ' does not match ' + match));
            }
          }

          cb(null);
        })
        .catch(error => { cb(error); });
    };

    async.retry({times: 40, interval: 50}, run, (err) => {
      if (err) {
        return callback(new Error(err.message));
      }

      return callback();
    });
  });

  this.Then(/^I delete the user "(.*?)"$/, function (id, callback) {
    id = this.idPrefix + id;

    this.api.deleteUser(id)
      .then(body => {
        if (body.error) {
          return callback(new Error(body.error.message));
        }

        callback();
      })
      .catch(error => { callback(error); });
  });

  this.Then(/^I am getting the current user, which matches \{(.*?)}$/, function (match, callback) {
    this.api.getCurrentUser()
      .then(body => {
        if (body.error) {
          return callback(new Error(body.error.message));
        }

        match = match.replace(/#prefix#/g, this.idPrefix);
        if (!_.matches(JSON.parse('{' + match + '}'))(body.result)) {
          return callback(new Error('Expected: ' + match + '\nGot: ' + JSON.stringify(body.result)));
        }

        callback();
      })
      .catch(error => { callback(error); });

  });

};

