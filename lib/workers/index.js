var
  async = require('async'),
  q = require('q');

module.exports = function Workers (kuzzle) {
  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function (options) {
    var deferred = q.defer();

    Object.keys(kuzzle.config.workers).forEach(groupWorkers => {
      kuzzle.pluginsManager.trigger('workerGroup:loaded', groupWorkers);

      /*
        Loads each worker in a worker group sequentially and in the same order as listed in
        the configuration file.
        This is done to allow some workers to depend on the presence of other workers.
       */
      async.each(kuzzle.config.workers[groupWorkers], (worker, callback) => {
        loadWorker.call(this, worker, options)
          .then(() => callback())
          .catch(error => {callback(new Error(`Worker "${worker}" failed to init: ${error}`))});
      }, error => {
        if (error) {
          return deferred.reject(error);
        }
        return deferred.resolve();
      });
    });
    return deferred.promise;
  };
};

function loadWorker(worker, options) {
  try {
    this.list[worker] = new (require('./' + worker))(this.kuzzle);
    return this.list[worker].init(options);
  }
  catch (error) {
    this.kuzzle.pluginsManager.trigger('log:error', 'Worker Loader: unable to load worker', worker, ': ', error.message);
    this.kuzzle.pluginsManager.trigger('log:info', 'Resuming loading workers...');
    return q.reject(error);
  }
}
