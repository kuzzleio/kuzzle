var
  q = require('q'),
  nr = require('newrelic');

module.exports = newrelic = {
  kuzzle: null,
  isEnabled: false,

  /**
   * @param {Kuzzle} kuzzle
   */
  init: function (kuzzle) {
    newrelic.kuzzle = kuzzle;
  },

  enabled: function (enable) {
    var controllers = ['write', 'read', 'admin', 'bulk'];

    controllers.forEach(function (controller) {
      newrelic.kuzzle.hooks.add(controller+':rest:start', 'monitoring:logRest');
      //newrelic.kuzzle.hooks.add(controller+':rest:stop', 'monitoring:end');

      newrelic.kuzzle.hooks.add(controller+':mq:start', 'monitoring:logMq');
      //newrelic.kuzzle.hooks.add(controller+':mq:stop', 'monitoring:end');

      newrelic.kuzzle.hooks.add(controller+':websocket:start', 'monitoring:logWs');
      //newrelic.kuzzle.hooks.add(controller+':websocket:stop', 'monitoring:end');
    });

    newrelic.kuzzle.hooks.init();
    this.isEnabled = enable;
  },

  log: function (type, modelObject) {
    //nr.setTransactionName(type + '/' + modelObject.controller + '/' + modelObject.action);
  }
};