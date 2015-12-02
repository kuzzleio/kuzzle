module.exports = {
  kuzzle: null,

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
  },

  add: function (requestObject) {
    requestObject.state = 'pending';
    this.kuzzle.notifier.publish(requestObject);
  }
};
