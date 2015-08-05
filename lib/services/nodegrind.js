var
  ng = require('nodegrind'),
  fs = require('fs');

module.exports = nodegrind = {
  kuzzle: null,
  isEnabled: false,
  hooksAlreadyAdded: false,

  /**
   * @param {Kuzzle} kuzzle
   */
  init: function (kuzzle) {
    nodegrind.kuzzle = kuzzle;
    nodegrind.isEnabled = false;
  },

  /**
   * Add needed hooks for profile
   */
  addHooks: function () {
    var controllers = ['write', 'read', 'admin', 'bulk', 'subscribe'];

    controllers.forEach(function (controller) {
      nodegrind.kuzzle.hooks.add(controller+':rest:start', 'profiling:startLog');
      nodegrind.kuzzle.hooks.add(controller+':mq:start', 'profiling:startLog');
      nodegrind.kuzzle.hooks.add(controller+':websocket:start', 'profiling:startLog');

      nodegrind.kuzzle.hooks.add(controller+':rest:stop', 'profiling:stopLog');
      nodegrind.kuzzle.hooks.add(controller+':mq:stop', 'profiling:stopLog');
      nodegrind.kuzzle.hooks.add(controller+':websocket:stop', 'profiling:stopLog');
    });
  },

  /**
   * Enable/disable the service profiling. If hooks are not already initialized, this function will call addHooks
   *
   * @param {Boolean} enable true if the service must be enabled, false if must be disabled
   */
  toggle: function (enable) {
    nodegrind.isEnabled = enable;

    if (!nodegrind.isEnabled) {
      nodegrind.kuzzle.log('Profiling service is disabled');
      return false;
    }

    if (!nodegrind.hooksAlreadyAdded) {
      nodegrind.addHooks();
    }
    nodegrind.kuzzle.log('Profiling service is enabled');
  },

  /**
   * Begin to start the CPU usage with an ID for identify the request.
   *
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   */
  startLog: function (modelObject) {
    if (!nodegrind.isEnabled) {
      return false;
    }

    ng.startCPU(modelObject.controller + '-' + modelObject.protocol + '-' + modelObject.timestamp + '-' + modelObject.requestId);
  },

  /**
   * Stop the collect of CPU usage and write a file with the profiling in 'profiling' folder.
   *
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   */
  stopLog: function (modelObject) {
    if (!nodegrind.isEnabled) {
      return false;
    }

    var
      id = modelObject.controller + '-' + modelObject.protocol + '-' + modelObject.timestamp + '-' + modelObject.requestId,
      prof = ng.stopCPU(id);

    fs.writeFile('profiling/' + id + '-callgrind.out', prof);
  }
};