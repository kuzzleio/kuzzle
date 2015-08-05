module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  startLog: function (object) {
    this.kuzzle.services.list.profiling.startLog(object);
  },

  stopLog: function (object) {
    this.kuzzle.services.list.profiling.stopLog(object);
  }

};