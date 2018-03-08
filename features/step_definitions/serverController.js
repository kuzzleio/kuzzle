const
  {
    When
  } = require('cucumber');

When(/^I check server health$/, function () {
  return this.api.healthCheck()
    .then(body => {
      if (body.error) {
        throw new Error(body.error.message);
      }

      if (!body.result) {
        throw new Error('No result provided');
      }

      if (!body.result.status || body.result.status !== 'green') {
        throw new Error(`Expected {status: green}, got: ${JSON.stringify(body.result)}`);
      }

      this.result = body.result;
    });
});

When(/^I get server informations$/, function (callback) {
  this.api.getServerInfo()
    .then(body => {
      if (body.error) {
        return callback(new Error(body.error.message));
      }

      if (!body.result) {
        return callback(new Error('No result provided'));
      }

      try {
        const routeInfo = body.result.serverInfo.kuzzle.api.routes.server.info;
        if (!routeInfo || routeInfo.controller !== 'server' || routeInfo.action !== 'info') {
          return callback(new Error('Unexpected/incorrect serverInfo content'));
        }
      }
      catch(e) {
        callback(e);
      }

      this.result = body.result;
      callback();
    })
    .catch(error => callback(error));
});

When(/^I get server configuration$/, function (callback) {
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
