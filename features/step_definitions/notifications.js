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

  this.Then(/^The notification should have volatile/, function (callback) {
    var
      diff = false;

    if (!this.api.responses.volatile) {
      return callback('Expected volatile in the notification but none was found');
    }

    diff = Object.keys(this.volatile).length !== Object.keys(this.api.responses.volatile).length;

    Object.keys(this.volatile).forEach(key => {
      if (!diff) {
        if (!this.api.responses.volatile[key]) {
          diff = true;
        } else {
          diff = JSON.stringify(this.volatile[key]).localeCompare(JSON.stringify(this.api.responses.volatile[key])) !== 0;
        }
      }
    });

    if (diff) {
      callback('Expected ' + JSON.stringify(this.api.responses.volatile) + ' to match ' + JSON.stringify(this.volatile));
    } else {
      callback();
    }

  });
};

module.exports = apiSteps;
