var
// Broker is a service that allow to use a broker for add and listen one/multiple queue(s)
  broker = require('../services/broker');

module.exports = {

  init: function (kuzzle) {
    broker.init(kuzzle);
    this.listen();
  },

  add: function (data) {
    broker.add('task_queue', data);
  },

  listen: function () {
    broker.listen('task_queue', onListenRealtimeCB);
  },

  shutdown: function () {
    broker.close();
  }
};

function onListenRealtimeCB (data) {
}