var
  q = require('q'),
  nr;

module.exports = newrelic = {
  kuzzle: null,

  /**
   * @param {Kuzzle} kuzzle
   */
  init: function (kuzzle) {
    nr = require('newrelic');
    newrelic.kuzzle = kuzzle;

    var controllers = ['write', 'read', 'admin', 'bulk'];

    controllers.forEach(function (controller) {
      newrelic.kuzzle.hooks.add(controller+':rest:start', 'monitoring:logRest');
      newrelic.kuzzle.hooks.add(controller+':mq:start', 'monitoring:logMq');
      newrelic.kuzzle.hooks.add(controller+':websocket:start', 'monitoring:logWs');
    });

    newrelic.kuzzle.hooks.init();
    newrelic.kuzzle.log('Monitoring service is enabled');
  },

  log: function (type, modelObject) {
    nr.setTransactionName(type + '/' + modelObject.controller + '/' + modelObject.action);
  }
};