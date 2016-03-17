module.exports = function (kuzzle) {
  this.kuzzle = kuzzle;
  this.uniquetaskQueue = null;

  /**
   * @param kuzzle
   */
  this.init = function () {
    this.uniquetaskQueue = this.kuzzle.config.queues.cleanAndPrepareQueue + '-' + process.pid;

    this.kuzzle.services.list.broker.listen(this.kuzzle.config.queues.cleanAndPrepareQueue, onListenCB.bind(this));
    this.kuzzle.services.list.broker.listen(this.uniquetaskQueue, onListenCB.bind(this));
  };
};

function onListenCB (data) {
  if (!data.id) {
    return false;
  }

  return this.kuzzle.cleanDb(this.kuzzle, true)
    .then(() => {
      return this.kuzzle.prepareDb(this.kuzzle, data.fixtures, data.mappings);
    })
    .then((response) => {
      this.kuzzle.services.list.broker.add(data.id, {result: response});
    })
    .catch((error) => {
      this.kuzzle.services.list.broker.add(data.id, {result: error});
    });
}
