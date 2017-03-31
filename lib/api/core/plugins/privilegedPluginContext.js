'use strict';

const
  PluginContext = require('./pluginContext');

/**
 * @class PrivilegedPluginContext
 * @extends PluginContext
 */
class PrivilegedPluginContext extends PluginContext {
  /**
   * @param {Kuzzle} kuzzle
   * @param {string} pluginName
   * @constructor
   */
  constructor (kuzzle, pluginName) {
    super(kuzzle, pluginName);

    this.accessors.kuzzle = kuzzle;
    this.constructors.services = {
      WsBrokerClient: require('../../../services/broker/wsBrokerClient'),
      WsBrokerServer: require('../../../services/broker/wsBrokerServer')
    };
  }
}

module.exports = PrivilegedPluginContext;
