var
  q = require('q'),
  nr;

module.exports = function (kuzzle) {
  this.kuzzle = kuzzle;

  this.init = function () {
    if (!process.env.NEW_RELIC_APP_NAME) {
      return false;
    }

    nr = require('newrelic');
    newrelic.kuzzle = kuzzle;

    var controllers = ['write', 'read', 'admin', 'bulk'];

    controllers.forEach(function (controller) {
      newrelic.kuzzle.hooks.add(controller+':rest:start', 'monitoring:logRest');
      newrelic.kuzzle.hooks.add(controller+':mq:start', 'monitoring:logMq');
      newrelic.kuzzle.hooks.add(controller+':websocket:start', 'monitoring:logWs');
    });

    newrelic.kuzzle.log('Monitoring service is enabled');
  };

  /**
   * Send to Newrelic the new transaction with the protocol, the controller and the action called
   *
   * @param {String} protocol can be websocket, mq or rest
   * @param {RequestObject|ResponseObject|RealTimeResponseObject} modelObject
   */
  this.log = function (protocol, modelObject) {
    nr.setTransactionName(protocol + '/' + modelObject.controller + '/' + modelObject.action);
  };
};