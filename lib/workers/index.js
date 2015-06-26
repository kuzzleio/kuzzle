var
// library for execute asynchronous methods
  async = require('async'),
  _ = require('lodash');

module.exports = function Workers (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;


  this.init = function () {
    var workers = this;

    async.each(this.kuzzle.config.workers, function parseGroupWorkers (groupWorkers) {
      _.each(groupWorkers, function parseWorker (worker) {
        if (!workers.list[worker]) {
          workers.list[worker] = require('./' + worker);
          workers.list[worker].init(workers.kuzzle);
        }
      });
    });

  };

  this.shutdownAll = function () {
    var workers = this;

    async.each(Object.keys(this.list), function parseAllWorkers (workerName) {
      if (workers.list[workerName].shutdown === 'function') {
        workers.list[workerName].shutdown();
      }
    });

  };
};