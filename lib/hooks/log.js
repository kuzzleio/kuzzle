module.exports = {

  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  log: function (object,event) {
    this.kuzzle.services.list.logger.log(object,event);
  }

};