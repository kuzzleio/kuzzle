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

  this.Then(/^I can retrieve the Kuzzle API version$/, function(callback) {
    if (this.result.serverInfo && this.result.serverInfo.kuzzle && this.result.serverInfo.kuzzle.api) {
      this.apiVersion = this.result.serverInfo.kuzzle.api;
      return callback();
    }

    callback(new Error('Unable to retrieve the API version from server informations'));
  });
};

module.exports = apiSteps;
