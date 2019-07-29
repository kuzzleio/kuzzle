const
  should = require('should'),
  {
    When,
    Then
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

When('I get the public API', function () {
  return this.api.serverPublicApi()
    .then(({ result }) => {
      this.apiResult = result;
    });
});

Then('I have the definition of kuzzle and plugins controllers', function () {
  const
    kuzzleControllers = [
      'auth', 'bulk', 'collection', 'document', 'index', 'ms', 'memoryStorage',
      'realtime', 'security', 'server', 'admin'
    ],
    responseControllers = Object.keys(this.apiResult);

  for (const controllerName of kuzzleControllers) {
    should(responseControllers).containEql(controllerName);

    for (const actionName of Object.keys(this.apiResult[controllerName])) {
      const action = this.apiResult[controllerName][actionName];

      should(action.controller).eql(controllerName);
      should(action.action).eql(actionName);

      // only theses methods from realtime have http routes
      if (!(controllerName === 'realtime' && (actionName !== 'list' || actionName !== 'publish'))) {
        should(action.http).be.instanceOf(Array);
      }
    }
  }
});