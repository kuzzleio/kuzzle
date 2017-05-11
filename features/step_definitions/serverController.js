var apiSteps = function () {
  this.When(/^I check server health$/, function (callback) {
    this.api.healthCheck()
      .then(body => {
        if (body.error) {
          return callback(new Error(body.error.message));
        }

        if (!body.result) {
          return callback(new Error('No result provided'));
        }

        if (!body.result.status || body.result.status !== 'green') {
          return callback('Expected {status: green"} got: ' + JSON.stringify(body.result));
        }

        this.result = body.result;
        callback();
      })
      .catch(error => callback(error));
  });

  this.When(/^I get server informations$/, function (callback) {
    this.api.getServerInfo()
      .then(body => {
        if (body.error) {
          return callback(new Error(body.error.message));
        }

        if (!body.result) {
          return callback(new Error('No result provided'));
        }

        this.result = body.result;
        callback();
      })
      .catch(error => callback(error));
  });

  this.When(/^I get server configuration$/, function (callback) {
    this.api.getServerConfig()
      .then(body => {
        if (body.error) {
          return callback(new Error(body.error.message));
        }

        if (!body.result) {
          return callback(new Error('No result provided'));
        }

        this.result = body.result;
        callback();
      })
      .catch(error => callback(error));
  });
};

module.exports = apiSteps;
