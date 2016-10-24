module.exports = {
  kuzzle: null,

  init: function hookPublishInit (kuzzle) {
    this.kuzzle = kuzzle;
  },

  add: function hookPublishAdd (requestObject) {
    requestObject.state = 'pending';
    this.kuzzle.notifier.publish(requestObject);
  }
};
