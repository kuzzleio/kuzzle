var
  PluginImplementationError = require('kuzzle-common-objects').Errors.PluginImplementationError,
  walk = require('walk'),
  path = require('path');

/**
 * Worker plugins should not have access to Kuzzle components
 *
 * @param kuzzle
 * @param isWorker - indicates if the context is required by a worker plugin (default: false)
 * @returns {Object} plugin context
 */
module.exports = function PluginContext(kuzzle, isWorker) {
  var
    context = {
      RequestObject: require('kuzzle-common-objects').Models.requestObject,
      ResponseObject: require('kuzzle-common-objects').Models.responseObject,
      NotificationObject: require('../models/notificationObject')
    },
    options = {
      listeners: {
        file: function (root, fileStats, next) {
          var prototype = fileStats.name.substr(0, fileStats.name.length - 3);
          if (fileStats.name.substr(-3) === '.js') {
            prototype = prototype[0].toUpperCase() + prototype.slice(1);
            context[prototype] = require(path.join(__dirname, '..', 'errors', fileStats.name));
          }
          next();
        }
      }
    };
  walk.walkSync(path.join(__dirname, '..', 'errors'), options);

  if (isWorker === undefined) {
    isWorker = false;
  }

  // Non-worker plugins only
  if (!isWorker) {
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

    context.httpPort = kuzzle.config.httpPort;
  }
  else {
    context.getRouter = context.repositories = context.remoteActions = function () {
      throw new PluginImplementationError('Worker plugins cannot access to Kuzzle objects');
    };
  }

  // Access to the DSL constructor
  context.Dsl = require('../../dsl');

  return context;
};
