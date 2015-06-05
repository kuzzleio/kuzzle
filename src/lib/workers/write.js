module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
    this.kuzzle.services.list.broker.init(kuzzle);

    this.listen();
  },

  add: function (data) {
    this.kuzzle.services.list.broker.add('task_queue', data);
  },

  listen: function () {
    this.kuzzle.services.list.broker.listen('task_queue', onListenRealtimeCB.bind(this));
  },

  shutdown: function () {
    this.kuzzle.services.list.broker.close();
  }
};

function onListenRealtimeCB (data) {
  this.kuzzle.services.list.writeEngine.write(data);
}