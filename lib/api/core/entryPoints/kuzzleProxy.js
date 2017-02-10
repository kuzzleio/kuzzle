'use strict';

var
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

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
 * @param {object} data
 */
function onRequest (data) {
  var request = new Request(data.data, data.options);

  this.kuzzle.funnel.execute(request, (error, result) => {
    this.kuzzle.services.list.proxyBroker.send('response', result.response);
  });
}

/**
 * @this {KuzzleProxy}
 * @param {object} data
 */
function onConnection (data) {
  this.kuzzle.router.newConnection(new RequestContext(data));
}

/**
 * @this {KuzzleProxy}
 * @param {object} data
 */
function onDisconnect (data) {
  this.kuzzle.router.removeConnection(new RequestContext(data));
}

/**
 * @this {KuzzleProxy}
 * @param {object} message
 */
function onHttpRequest (message) {
  this.kuzzle.router.router.route(message, response => {
    this.kuzzle.services.list.proxyBroker.send('httpResponse', response);
  });
}

module.exports = KuzzleProxy;
