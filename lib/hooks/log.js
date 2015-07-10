module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  log: function (object) {
    this.kuzzle.services.list.logger.add(object);
  }

};