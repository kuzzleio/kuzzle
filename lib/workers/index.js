var
  async = require('async'),
  q = require('q');

module.exports = function Workers (kuzzle) {
  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    var self = this;
    async.each(Object.keys(kuzzle.config.workers), function parseGroupWorkers (groupWorkers) {
      kuzzle.pluginsManager.trigger('workerGroup:loaded', groupWorkers);

      /*
        Loads each worker in a worker group sequentially and in the same order than listed in
        the configuration file.
        This is done to allow some workers to depend on the presence of other workers.
       */
      kuzzle.config.workers[groupWorkers].reduce(function (previous, current) {
        return previous.then(loadWorker.call(self, current));
      }, q());
    });
  };
};

function loadWorker(worker) {
  try {
    this.list[worker] = new (require('./' + worker))(this.kuzzle);
    return this.list[worker].init();
  }
  catch (error) {
    this.kuzzle.pluginsManager.trigger('log:error', 'Worker Loader: unable to load worker', worker, ': ', error.message);
    this.kuzzle.pluginsManager.trigger('log:info', 'Resuming loading workers...');
    return q.reject(error);
  }
}
