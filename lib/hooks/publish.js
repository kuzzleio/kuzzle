module.exports = {
  kuzzle: null,

  init: function hookPublishInit (kuzzle) {
    this.kuzzle = kuzzle;
  },

  /**
   * @param {Request} request
   */
  add: function hookPublishAdd (request) {
    request.input.args.state = 'pending';
    this.kuzzle.notifier.publish(request);
  }
};
