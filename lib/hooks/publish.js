module.exports = {
  kuzzle: null,

  init: function hookPublishInit (kuzzle) {
    this.kuzzle = kuzzle;
  },

  add: function hookPublishAdd (data) {
    data.requestObject.state = 'pending';
    this.kuzzle.notifier.publish(data.requestObject);
  }
};
