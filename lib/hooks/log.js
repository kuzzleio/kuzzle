module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  log: function (object, hookEvent) {
    this.kuzzle.services.list.logger.log(object, hookEvent);
  },

  error: function (error, hookEvent) {
    this.kuzzle.services.list.logger.error(error, hookEvent);
  }

};