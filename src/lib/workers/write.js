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
  if (data.persist === false) {
    return false;
  }

  if (typeof this.kuzzle.services.list.writeEngine[data.action] !== 'function') {
    return false;
  }

  return this.kuzzle.services.list.writeEngine[data.action](data);
}