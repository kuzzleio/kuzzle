var
  ng = require('nodegrind'),
  fs = require('fs');

module.exports = function (kuzzle) {
  this.kuzzle = kuzzle;
  this.isEnabled = false;
  this.hooksAlreadyAdded = false;

  this.init = function () {
  };

  /**
   * Add needed hooks for profile
   */
  this.addHooks = function () {
    var controllers = ['write', 'read', 'admin', 'bulk', 'subscribe'];

    controllers.forEach(function (controller) {
      this.kuzzle.hooks.add(controller+':rest:start', 'profiling:startLog');
      this.kuzzle.hooks.add(controller+':mq:start', 'profiling:startLog');
      this.kuzzle.hooks.add(controller+':websocket:start', 'profiling:startLog');

      this.kuzzle.hooks.add(controller+':rest:stop', 'profiling:stopLog');
      this.kuzzle.hooks.add(controller+':mq:stop', 'profiling:stopLog');
      this.kuzzle.hooks.add(controller+':websocket:stop', 'profiling:stopLog');
    }.bind(this));

    var workers = ['worker:write'];

    workers.forEach(function (worker) {
      this.kuzzle.hooks.add(worker + ':rest:start', 'profiling:startLog');
      this.kuzzle.hooks.add(worker + ':mq:start', 'profiling:startLog');
      this.kuzzle.hooks.add(worker + ':websocket:start', 'profiling:startLog');

      this.kuzzle.hooks.add(worker + ':rest:stop', 'profiling:stopLog');
      this.kuzzle.hooks.add(worker + ':mq:stop', 'profiling:stopLog');
      this.kuzzle.hooks.add(worker + ':websocket:stop', 'profiling:stopLog');
    }.bind(this));

    this.hooksAlreadyAdded = true;
  };

  /**
   * Enable/disable the service profiling. If hooks are not already initialized, this function will call addHooks
   *
   * @param {Boolean} enable true if the service must be enabled, false if must be disabled
   * @return {Promise}
   */
  this.toggle = function (enable) {
    if (this.isEnabled === enable) {
      return Promise.reject(new Error('Profiling service is already ' + (enable ? 'enabled' : 'disabled')));
    }

    this.isEnabled = enable;

    if (!this.isEnabled) {
      this.kuzzle.pluginsManager.trigger('profiling:stop', 'Profiling service is disabled');
      return Promise.resolve('Profiling service is disabled');
    }

    if (!this.hooksAlreadyAdded) {
      this.addHooks();
    }
    this.kuzzle.pluginsManager.trigger('profiling:start', 'Profiling service is enabled');
    return Promise.resolve('Profiling service is enabled');
  };

  /**
   * Begin to start the CPU usage with an ID for identify the request.
   *
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   * @param {String} worker string that identify the worker where the hook comes from
   */
  this.startLog = function (modelObject, worker) {
    if (!this.isEnabled) {
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
  };

  /**
   * Stop the collect of CPU usage and write a file with the profiling in 'profiling' folder.
   *
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   * @param {String} worker string that identify the worker where the hook comes from
   */
  this.stopLog = function (modelObject, worker) {
    if (!this.isEnabled) {
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
  };
};
