module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  startLog: function (object, event) {
    var
      worker = false,
      path = event.split(':');

    if (path[0] === 'worker') {
      worker = path[1];
    }

    this.kuzzle.services.list.profiling.startLog(object, worker);
  },

  stopLog: function (object, event) {
    var
      worker = false,
      path = event.split(':');

    if (path[0] === 'worker') {
      worker = path[1];
    }

    this.kuzzle.services.list.profiling.stopLog(object, worker);
  }

};