module.exports = function PluginContext(kuzzle) {
  var
    context = require('kuzzle-common-objects').Errors;

  context.RequestObject = require('kuzzle-common-objects').Models.requestObject;
  context.ResponseObject = require('kuzzle-common-objects').Models.responseObject;

  // Add lazy-loading repositories getter:
  context.repositories = function () {
    return kuzzle.repositories;
  };

  // Add lazy-loading remoteActions getter:
  context.remoteActions = function () {
    return kuzzle.remoteActionsController;
  };

  // Add lazy-loading router getter:
  context.getRouter = function () {
    return {
      newConnection: kuzzle.router.newConnection.bind(kuzzle.router),
      execute: kuzzle.router.execute.bind(kuzzle.router),
      removeConnection: kuzzle.router.removeConnection.bind(kuzzle.router)
    };
  };

  // Access to the DSL constructor
  context.Dsl = require('../../dsl');

  context.httpPort = kuzzle.config.httpPort;

  return context;

};
