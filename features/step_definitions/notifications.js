var
  async = require('async');

var apiSteps = function () {
  this.Then(/^I should receive a "([^"]*)" notification$/, function (action, callback) {
    var main = function (callbackAsync) {
      setTimeout(function () {
        if (this.api.responses) {
          if (this.api.responses.error) {
            callbackAsync('An error occurred ' + this.api.response.error.toString());
            return false;
          }

          if (this.api.responses.action !== action) {
            callbackAsync('Action "' + this.api.responses.action + '" received. Expected: "' + action + '"');
            return false;
          }

          callbackAsync();
        } else {
          callbackAsync('No notification received');
        }
      }.bind(this), 20);
    };

    async.retry(20, main.bind(this), function (err) {
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

  this.Then(/^The notification should ?(not)* have a "([^"]*)" member/, function (not, member, callback) {
    if ((this.api.responses.result[member] || not) && !(this.api.responses.result[member] && not)) {
      callback();
    }
    else {
      callback('The document was ' + (not ? 'not ' : '') + 'supposed to contain the member "' + member + '"');
    }
  });

  this.Then(/^The notification should have metadata$/, function (callback) {
    var
      diff = false;

    if (!this.api.responses.metadata) {
      return callback('Expected metadata in the notification but none was found');
    }

    diff = Object.keys(this.metadata).length !== Object.keys(this.api.responses.metadata).length;

    Object.keys(this.metadata).forEach(key => {
      if (!diff) {
        if (!this.api.responses.metadata[key]) {
          diff = true;
        } else {
          diff = JSON.stringify(this.metadata[key]).localeCompare(JSON.stringify(this.api.responses.metadata[key])) !== 0;
        }
      }
    });

    if (diff) {
      callback('Expected ' + JSON.stringify(this.api.responses.metadata) + ' to match ' + JSON.stringify(this.metadata));
    } else {
      callback();
    }

  });
};

module.exports = apiSteps;
