var
  _ = require('lodash');

function PluginContext (kuzzle) {
  this.accessors = {};
  this.config = kuzzle.config;
  this.constructors = {
    Dsl: require('../../dsl'),
    RequestObject: require('kuzzle-common-objects').Models.requestObject,
    ResponseObject: require('kuzzle-common-objects').Models.responseObject
  };
  this.errors = {};

  _.forOwn(require('kuzzle-common-objects').Errors, (constructor, name) => {
    this.errors[_.upperFirst(name)] = constructor;
  });

  // lazy-loading accessors
  if (kuzzle.router) {
    Object.defineProperty(this.accessors, 'router', {
      enumerable: true,
      get: function () {
        return {
          newConnection: kuzzle.router.newConnection.bind(kuzzle.router),
          execute: kuzzle.router.execute.bind(kuzzle.router),
          removeConnection: kuzzle.router.removeConnection.bind(kuzzle.router)
        };
      }
    });
  }

  if (kuzzle.repositories) {
    Object.defineProperty(this.accessors, 'repositories', {
      enumerable: true,
      get: function () {
        return kuzzle.repositories;
      }
    });
  }

  if (kuzzle.remoteActions) {
    Object.defineProperty(this.accessors, 'remoteActions', {
      enumerable: true,
      get: function () {
        return kuzzle.remoteActionsController;
      }
    });
  }
}

module.exports = PluginContext;
