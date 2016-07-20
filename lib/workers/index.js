var
  async = require('async'),
  Promise = require('bluebird');

/**
 * @property {Object} list
 * @property {Kuzzle} kuzzle
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function Workers (kuzzle) {
  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function (options) {
    var promises;

    promises = Object.keys(kuzzle.config.workers).map(groupWorkers => {
      return new Promise((resolve, reject) => {
        kuzzle.pluginsManager.trigger('workerGroup:loaded', groupWorkers);

        /*
         Loads each worker in a worker group sequentially and in the same order as listed in
         the configuration file.
         This is done to allow some workers to depend on the presence of other workers.
         */
        async.each(kuzzle.config.workers[groupWorkers], (worker, callback) => {
          loadWorker.call(this, worker, options)
            .then(() => callback())
            .catch(error => {
              error.message = `Worker "${worker}" failed to init: ${error}`;
              callback(error);
            });
        }, error => {
          if (error) {
            return reject(error);
          }

          resolve();
        });
      });
    });

    return Promise.all(promises);
  };
}

/**
 * @this {Workers}
 * @param worker
 * @param options
 * @returns {Promise}
 */
function loadWorker(worker, options) {
  try {
    this.list[worker] = new (require('./' + worker))(this.kuzzle);
    return this.list[worker].init(options);
  }
  catch (error) {
    this.kuzzle.pluginsManager.trigger('log:error', `Worker Loader: unable to load worker ${worker}: ${error.message}`);
    this.kuzzle.pluginsManager.trigger('log:info', 'Resuming loading workers...');
    return Promise.reject(error);
  }
}

module.exports = Workers;
