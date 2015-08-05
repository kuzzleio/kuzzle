var
  ng = require('nodegrind'),
  fs = require('fs');

module.exports = nodegrind = {
  kuzzle: null,
  isEnabled: false,

  /**
   * @param {Kuzzle} kuzzle
   */
  init: function (kuzzle) {
    nodegrind.kuzzle = kuzzle;

    var controllers = ['write', 'read', 'admin', 'bulk', 'subscribe'];

    controllers.forEach(function (controller) {
      nodegrind.kuzzle.hooks.add(controller+':rest:start', 'profiling:startLog');
      nodegrind.kuzzle.hooks.add(controller+':mq:start', 'profiling:startLog');
      nodegrind.kuzzle.hooks.add(controller+':websocket:start', 'profiling:startLog');

      nodegrind.kuzzle.hooks.add(controller+':rest:stop', 'profiling:stopLog');
      nodegrind.kuzzle.hooks.add(controller+':mq:stop', 'profiling:stopLog');
      nodegrind.kuzzle.hooks.add(controller+':websocket:stop', 'profiling:stopLog');
    });

    nodegrind.isEnabled = false;
  },

  toggle: function (enable) {
    nodegrind.isEnabled = enable;

    if (!nodegrind.isEnabled) {
      nodegrind.kuzzle.log('Profiling service is disabled');
      return false;
    }

    nodegrind.kuzzle.log('Profiling service is enabled');
  },

  startLog: function (modelObject) {
    if (!nodegrind.isEnabled) {
      return false;
    }

    ng.startCPU(modelObject.controller + '-' + modelObject.protocol + '-' + (new Date().getTime()) + '-' + modelObject.requestId);
  },

  stopLog: function (modelObject) {
    if (!nodegrind.isEnabled) {
      return false;
    }

    var
      id = modelObject.controller + '-' + modelObject.protocol + '-' + modelObject.requestId,
      prof = ng.stopCPU(id);

    fs.writeFile('profiling/' + id + '-callgrind.out', prof);
  }
};