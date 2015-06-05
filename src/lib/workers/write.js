module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
    this.kuzzle.services.broker.init(kuzzle);

    this.listen();
  },

  add: function (data) {
    this.kuzzle.services.broker.add('task_queue', data);
  },

  listen: function () {
    this.kuzzle.services.broker.listen('task_queue', onListenRealtimeCB.bind(this));
  },

  shutdown: function () {
    this.kuzzle.services.broker.close();
  }
};

function onListenRealtimeCB (data) {
  this.kuzzle.services.writeEngine(data);
}