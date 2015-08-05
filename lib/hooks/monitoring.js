module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  logRest: function (object) {
    this.kuzzle.services.list.monitoring.log('rest', object);
  },

  logMq: function (object) {
    this.kuzzle.services.list.monitoring.log('mq', object);
  },

  logWs: function (object) {
    this.kuzzle.services.list.monitoring.log('websocket', object);
  }

};