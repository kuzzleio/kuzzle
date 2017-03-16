var apiSteps = function () {
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
