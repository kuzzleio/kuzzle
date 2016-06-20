var
  _ = require('lodash'),
  config = require('./config')(),
  q = require('q'),
  uuid = require('node-uuid'),
  io = require('socket.io-client'),
  ApiRT = require('./apiRT');

var initSocket = function (socketName) {
  var socket;

  if (!socketName) {
    socketName = 'client1';
  }

  if (!this.listSockets[socketName]) {
    socket = io(config.ws, { 'force new connection': true });
    this.listSockets[socketName] = socket;

    // the default socket is the socket with name 'client1'
    if (socketName === 'client1') {
      this.socket = socket;
    }
  }

  return socketName;
};

/** CONSTRUCT **/
var ApiWebsocket = function () {
  ApiRT.call(this);
};
ApiWebsocket.prototype = new ApiRT();

/** SPECIFIC FOR WEBSOCKET */
ApiWebsocket.prototype.listSockets = {};

ApiWebsocket.prototype.init = function (world) {
  this.world = world;
  this.responses = null;

  initSocket.call(this, 'client1');
};

ApiWebsocket.prototype.disconnect = function () {
  Object.keys(this.listSockets).forEach(socket => {
    this.listSockets[socket].destroy();
    delete this.listSockets[socket];
  });
};

ApiWebsocket.prototype.unsubscribe = function (room, socketName) {
  var
    msg = {
      controller: 'subscribe',
      action: 'off',
      collection: this.world.fakeCollection,
      index: this.world.fakeIndex,
      body: { roomId: room }
    };

  socketName = initSocket.call(this, socketName);

  this.listSockets[socketName].removeListener(this.subscribedRooms[socketName][room].channel, this.subscribedRooms[socketName][room].listener);
  delete this.subscribedRooms[socketName][room];
  return this.send(msg, false, socketName);
};

ApiWebsocket.prototype.send = function (msg, getAnswer, socketName) {
  var
    deferred = q.defer(),
    routename = 'kuzzle',
    listen = (getAnswer !== undefined) ? getAnswer : true;

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  msg.metadata = this.world.metadata;

  if (this.world.currentUser && this.world.currentUser.token) {
    if (!msg.headers) {
      msg.headers = {};
    }
    msg.headers = _.extend(msg.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
  }

  socketName = initSocket.call(this, socketName);

  if (listen) {
    this.listSockets[socketName].once(msg.requestId, function (result) {
      if (result.error) {
        result.error.statusCode = result.status;
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    });
  }
  else {
    deferred.resolve({});
  }

  this.listSockets[socketName].emit(routename, msg);

  return deferred.promise;
};

ApiWebsocket.prototype.sendAndListen = function (msg, socketName) {
  var
    deferred = q.defer(),
    routename = 'kuzzle';

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  msg.metadata = this.world.metadata;

  socketName = initSocket.call(this, socketName);
  this.listSockets[socketName].once(msg.requestId, response => {
    var listener = document => {this.responses = document;};

    if (response.error) {
      deferred.reject(response.error.message);
      return false;
    }

    if (!this.subscribedRooms[socketName]) {
      this.subscribedRooms[socketName] = {};
    }

    this.subscribedRooms[socketName][response.result.roomId] = {channel: response.result.channel, listener: listener };
    this.listSockets[socketName].on(response.result.channel, listener.bind(this));
    deferred.resolve(response);
  });

  this.listSockets[socketName].emit(routename, msg);

  return deferred.promise;
};

module.exports = ApiWebsocket;
