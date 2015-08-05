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

    newrelic.kuzzle.log('Monitoring service is enabled');
  },

  /**
   * Send to Newrelic the new transaction with the protocol, the controller and the action called
   *
   * @param {String} protocol can be websocket, mq or rest
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   */
  log: function (protocol, modelObject) {
    nr.setTransactionName(protocol + '/' + modelObject.controller + '/' + modelObject.action);
  }
};