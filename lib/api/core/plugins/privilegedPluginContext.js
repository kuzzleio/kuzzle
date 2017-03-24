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
   * @constructor
   */
  constructor (kuzzle) {
    super(kuzzle);

    this.accessors.kuzzle = kuzzle;
    this.constructors.services = {
      WsBrokerClient: require('../../../services/broker/wsBrokerClient'),
      WsBrokerServer: require('../../../services/broker/wsBrokerServer')
    };
  }
}

module.exports = PrivilegedPluginContext;
