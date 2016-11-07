var
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

/**
 * Manage communication with the load balancer
 *
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function KuzzleProxy (kuzzle) {
  this.kuzzle = kuzzle;
  this.channels = {};
}

KuzzleProxy.prototype.init = function kuzzleProxyInit () {
  this.kuzzle.services.list.proxyBroker.listen('request', onRequest.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('connection', onConnection.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('disconnect', onDisconnect.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('error', onDisconnect.bind(this));
  this.kuzzle.services.list.proxyBroker.send('httpPortInitialization', {httpPort: this.kuzzle.config.server.http.port});
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
  var requestObject;

  if (data.request && data.context && data.context.connection && data.context.connection.type) {
    requestObject = new RequestObject(data.request, data.request.data, data.context.connection.type);

    this.kuzzle.funnel.execute(requestObject, data.context, (error, responseObject) => {
      this.kuzzle.services.list.proxyBroker.send('response', {
        requestId: responseObject.requestId,
        response: responseObject.toJson(),
        connection: data.context.connection
      });
    });
  }
}

/**
 * @this {KuzzleProxy}
 * @param data
 */
function onConnection (data) {
  if (data.context && data.context.connection && data.context.connection.type && data.context.connection.id) {
    this.kuzzle.router.newConnection(data.context.connection.type, data.context.connection.id);
  }
}

/**
 * @this {KuzzleProxy}
 * @param data
 */
function onDisconnect (data) {
  if (data.context) {
    this.kuzzle.router.removeConnection(data.context);
  }
}

module.exports = KuzzleProxy;
