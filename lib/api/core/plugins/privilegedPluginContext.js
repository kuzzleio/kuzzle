var
  PluginContext = require('./pluginContext'),
  util = require('util');

function PrivilegedPluginContext (kuzzle) {
  PluginContext.call(this, kuzzle);
  this.accessors.kuzzle = kuzzle;
  this.constructors.services = {
    WsBrokerClient: require('../../../services/broker/wsBrokerClient'),
    WsBrokerServer: require('../../../services/broker/wsBrokerServer')
  };
}

util.inherits(PrivilegedPluginContext, PluginContext);

module.exports = PrivilegedPluginContext;
