var apiSteps = function () {
  this.When(/^I check server health$/, function (callback) {
    this.api.healthCheck()
      .then(response => {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        if (!this.result.status || this.result.status !== 'ok') {
          return callback('Expected {status: "ok"} got: ' + this.result);
        }
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
