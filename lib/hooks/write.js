module.exports = {
  kuzzle: null,

  init: function hookWriteInit (kuzzle) {
    this.kuzzle = kuzzle;
  },

  emit: function hookWriteEmit (requestObject) {
    this.kuzzle.services.list.broker.send(this.kuzzle.config.queues.workerWriteTaskQueue, requestObject);
  },

  broadcast: function hookWriteBroadcast (requestObject) {
    this.kuzzle.services.list.broker.broadcast(this.kuzzle.config.queues.workerWriteTaskQueue, requestObject);
  }
};
