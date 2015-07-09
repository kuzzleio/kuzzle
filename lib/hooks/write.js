module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  add: function (requestObject) {
    if (requestObject.isPersistent()) {
      this.kuzzle.log.verbose('trigger event request:http in pubsub');
      this.kuzzle.services.list.broker.add(this.kuzzle.workers.list.write.taskQueue, requestObject);
    }
  }

};