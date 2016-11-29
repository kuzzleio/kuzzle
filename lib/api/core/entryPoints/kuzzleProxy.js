'use strict';

var Request = require('kuzzle-common-objects').Request;

/**
 * Manage communication with the load balancer
 *
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function KuzzleProxy (kuzzle) {
  this.kuzzle = kuzzle;
  this.channels = {};

  return this;
}

KuzzleProxy.prototype.init = function kuzzleProxyInit () {
  this.kuzzle.services.list.proxyBroker.listen('request', onRequest.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('connection', onConnection.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('disconnect', onDisconnect.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('error', onDisconnect.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('httpRequest', onHttpRequest.bind(this));
};

KuzzleProxy.prototype.joinChannel = function kuzzleProxyJoinChannel (data) {
  this.kuzzle.services.list.proxyBroker.send('joinChannel', data);
};

KuzzleProxy.prototype.leaveChannel = function kuzzleProxyLeaveChannel (data) {
  this.kuzzle.services.list.proxyBroker.send('leaveChannel', data);
};

KuzzleProxy.prototype.dispatch = function kuzzleProxyDispatch (event, data) {
  this.kuzzle.services.list.proxyBroker.send(event, data);
};

/**
 * @this {KuzzleProxy}
 * @param data
 */
function onRequest (data) {
  var request = new Request(data.request, data.options);

  this.kuzzle.funnel.execute(request, (error, result) => {
    this.kuzzle.services.list.proxyBroker.send('response', result.serialize());
  });
}

/**
 * @this {KuzzleProxy}
 * @param data
 */
function onConnection (data) {
  var request = new Request(data.request, data.options);

  this.kuzzle.router.newConnection(request);
}

/**
 * @this {KuzzleProxy}
 * @param data
 */
function onDisconnect (data) {
  var request = new Request(data.request, data.options);

  this.kuzzle.router.removeConnection(request);
}

/**
 * @this {KuzzleProxy}
 * @param message
 */
function onHttpRequest (message) {
  this.kuzzle.router.router.route(message.request, response => {
    this.kuzzle.services.list.proxyBroker.send('httpResponse', response.getResponse());
  });
}

module.exports = KuzzleProxy;
