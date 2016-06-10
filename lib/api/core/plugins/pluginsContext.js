var
  util = require('util'),
  errors = require('kuzzle-common-objects').Errors,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  NotificationObject = require('../models/notificationObject'),
  _kuzzle;


function PluginContext () {
  this.RequestObject = RequestObject;
  this.RequestObject = ResponseObject;
  this.NotificationObject = NotificationObject;
  this.Dsl = require('../../dsl');
  this.httpPort = _kuzzle.config.httpPort;

  Object.keys(errors).forEach(errorConstructor => {
    this[errorConstructor] = errors[errorConstructor];
  });

  this.repositories = function () {
    return _kuzzle.repositories;
  };

  this.remoteActions = function () {
    return _kuzzle.remoteActionsController;
  };

  this.getRouter = function () {
    return {
      newConnection: _kuzzle.router.newConnection.bind(_kuzzle.router),
      execute: _kuzzle.router.execute.bind(_kuzzle.router),
      removeConnection: _kuzzle.router.removeConnection.bind(_kuzzle.router)
    };
  };
}

function PrivilegedPluginContext () {
  this.kuzzle = _kuzzle;

  this.constructors = {
    services: {
      broker: {
        WsBrokerClient: require('../../../services/broker/wsBrokerClient'),
        WsBrokerServer: require('../../../services/broker/wsBrokerServer')
      }
    }
  };
}

util.inherits(PrivilegedPluginContext, PluginContext);


module.exports = function (kuzzle) {
  _kuzzle = kuzzle;

  return {
    pluginContext: new PluginContext(),
    privilegedPluginContext: new PrivilegedPluginContext()
  };
};
