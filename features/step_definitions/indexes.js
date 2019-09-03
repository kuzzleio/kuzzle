const
  {
    When,
    Then
  } = require('cucumber'),
  async = require('async'),
  Bluebird = require('bluebird');

When(/^I create an index named "([^"]*)"$/, function (index, callback) {
  this.api.createIndex(index)
    .then(body => {
      if (body.error) {
        callback(new Error(body.error.message));
        return false;
      }

      if (!body.result) {
        callback(new Error('No result provided'));
        return false;
      }

      this.result = body.result;
      callback();
    })
    .catch(error => callback(error));
});

Then(/^I'm ?(not)* able to find the index named "([^"]*)" in index list$/, function (not, index, callback) {
  var main = function (callbackAsync) {
    this.api.listIndexes()
      .then(body => {
        if (body.error && !not) {
          if (body.error.message) {
            callbackAsync(body.error.message);
            return false;
          }

          callbackAsync(body.error);
          return false;
        }

        if (!body.result || !body.result.indexes) {
          if (not) {
            callbackAsync();
            return true;
          }

          callbackAsync('No result provided');
          return false;
        }

        if (body.result.indexes.indexOf(index) !== -1) {
          if (not) {
            callbackAsync('Index ' + index + ' exists');
            return false;
          }

          callbackAsync();
          return true;
        }


        if (not) {
          callbackAsync();
          return true;
        }

        callbackAsync('Index ' + index + ' is missing');
      })
      .catch(function (error) {
        if (not) {
          callbackAsync();
          return false;
        }

        callbackAsync(error);
        return true;
      });
  };


  async.retry({times: 20, interval: 20}, main.bind(this), function (err) {
    if (err) {
      if (err.message) {
        err = err.message;
      }
      callback(new Error(err));
      return false;
    }
    callback();
  });
});

Then(/^I'm able to delete the index named "([^"]*)"$/, function (index, callback) {
  this.api.deleteIndex(index)
    .then(body => {
      if (body.error) {
        if (body.error.message) {
          callback(body.error.message);
          return false;
        }

        callback(body.error);
        return false;
      }

      callback();
    })
    .catch(error => callback(error));
});
