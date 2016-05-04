module.exports = {
  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  add: function (requestObject) {
    this.kuzzle.services.list.broker.add(this.kuzzle.config.queues.workerWriteTaskQueue, requestObject);
  },

  broadcast: function (requestObject) {
    this.kuzzle.services.list.broker.broadcast(this.kuzzle.config.queues.workerWriteTaskQueue, requestObject);
  }
};
