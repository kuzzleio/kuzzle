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

    var workers = ['worker:write'];

    workers.forEach(function (worker) {
      nodegrind.kuzzle.hooks.add(worker + ':rest:start', 'profiling:startLog');
      nodegrind.kuzzle.hooks.add(worker + ':mq:start', 'profiling:startLog');
      nodegrind.kuzzle.hooks.add(worker + ':websocket:start', 'profiling:startLog');

      nodegrind.kuzzle.hooks.add(worker + ':rest:stop', 'profiling:stopLog');
      nodegrind.kuzzle.hooks.add(worker + ':mq:stop', 'profiling:stopLog');
      nodegrind.kuzzle.hooks.add(worker + ':websocket:stop', 'profiling:stopLog');
    });

    nodegrind.hooksAlreadyAdded = true;
  },

  /**
   * Enable/disable the service profiling. If hooks are not already initialized, this function will call addHooks
   *
   * @param {Boolean} enable true if the service must be enabled, false if must be disabled
   * @return {Promise}
   */
  toggle: function (enable) {
    if (nodegrind.isEnabled === enable) {
      return Promise.reject('Profiling service is already ' + (enable ? 'enabled' : 'disabled'));
    }

    nodegrind.isEnabled = enable;

    if (!nodegrind.isEnabled) {
      nodegrind.kuzzle.log('Profiling service is disabled');
      return Promise.resolve('Profiling service is disabled');
    }

    if (!nodegrind.hooksAlreadyAdded) {
      nodegrind.addHooks();
    }
    nodegrind.kuzzle.log('Profiling service is enabled');
    return Promise.resolve('Profiling service is enabled');
  },

  /**
   * Begin to start the CPU usage with an ID for identify the request.
   *
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   * @param {String} worker string that identify the worker where the hook comes from
   */
  startLog: function (modelObject, worker) {
    if (!nodegrind.isEnabled) {
      return false;
    }

    var id = '';

    if (worker) {
      id += 'worker-' + worker;
    }
    else {
      id += modelObject.controller;
    }

    id += '-' + modelObject.protocol + '-' + modelObject.timestamp + '-' + modelObject.requestId;
    ng.startCPU(id);
  },

  /**
   * Stop the collect of CPU usage and write a file with the profiling in 'profiling' folder.
   *
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   * @param {String} worker string that identify the worker where the hook comes from
   */
  stopLog: function (modelObject, worker) {
    if (!nodegrind.isEnabled) {
      return false;
    }

    var
      id = '',
      prof;

    if (worker) {
      id += 'worker-' + worker;
    }
    else {
      id += modelObject.controller;
    }


    id += '-' + modelObject.protocol + '-' + modelObject.timestamp + '-' + modelObject.requestId;
    prof = ng.stopCPU(id);

    fs.writeFile('profiling/' + id + '-callgrind.out', prof);
  }
};