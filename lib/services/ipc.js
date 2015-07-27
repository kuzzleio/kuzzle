var
  async = require('async'),
  _ = require('lodash'),
  uuid = require('node-uuid'),
  q = require('q'),
  captainsLog = require('captains-log'),
  url = require('url'),
  ipc = require('node-ipc'),
  // Internal communication constants
  DISPATCH_MESSAGE = 'ipc-broker-dispatch',
  START_LISTENER = 'ipc-broker-start-listener',
  STOP_LISTENER = 'ipc-broker-stop-listener';

module.exports = broker =  {
  serverName: 'kuzzle',
  log: captainsLog(),
  kuzzleConfig: null,
  host: null,
  port: null,
  connected: null,
  listeners: {},

  /**
   * Initialize the connection with the internal IPC broker
   * @param kuzzleConfig
   */
  init: function (kuzzleConfig) {
    this.kuzzleConfig = kuzzleConfig;
    this.host = this.kuzzleConfig.broker.host;
    this.port = Number(this.kuzzleConfig.broker.port);

    ipc.config.id = uuid.v1();
    ipc.config.silent = true;
    ipc.config.retry = 1500;
    ipc.config.maxRetries=10;
  },

  startServer: function () {
    var deferred = q.defer();

    ipc.config.id = this.serverName;

    ipc.serveNet(this.host, this.port, function () {
      ipc.server.on(START_LISTENER, addListener.bind(this));
      ipc.server.on(STOP_LISTENER, removeListener.bind(this));
      ipc.server.on(DISPATCH_MESSAGE, sendToListeners.bind(this));

      deferred.resolve('Internal broker started');
    }.bind(this));

    ipc.server.start();

    return deferred.promise;
  },

  /**
   * Sends data to a room
   * @param room
   * @param data object that must be insert in queue
   */
  add: function (room, data) {
    connect.call(this).then(function () {
      ipc.of[this.serverName].emit(DISPATCH_MESSAGE, {room: room, message: data});
    }.bind(this));
  },

  /**
   * Listen a specific room and execute a callback for each messages
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   */
  listen: function (room, onListenCB) {
    if (!room) {
      return false;
    }
    connect.call(this).then(function () {
      ipc.of[this.serverName].emit(START_LISTENER, { id: ipc.config.id, room: room });
      ipc.of[this.serverName].on(room, function (data) {
        onListenCB(data);
      });
    }.bind(this))
    .catch(function (error) {
      this.log.error('Unable to start a listener on room ', room, '\nError: ', error);
      }.bind(this));
  },

  /**
   * Listen to a specific room and execute a callback once a message is received
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   */
  listenOnce: function (room, onListenCB) {
    if (!room) {
      return false;
    }

    connect.call(this).then(function () {
      ipc.of[this.serverName].on(room, function (data) {
        onListenCB(data);
        ipc.of[this.serverName].off(room);
        ipc.of[this.serverName].emit(STOP_LISTENER, { id: ipc.config.id, room: room });
      }.bind(this));
    }.bind(this))
    .catch(function (error) {
      this.log.error('Unable to start a listener on room ', room, '\nError: ', error);
    }.bind(this));
  },

  close: function () {
    async.each(Object.keys(ipc.of), function (socket, callback) {
      ipc.disconnect(socket);
      callback();
    });
  }
};

/**
 * Initializes a connection to the socket server, if not already created
 *
 * @returns promise
 */
function connect() {
  var deferred = q.defer();

  if (!ipc.of[this.serverName]) {
      ipc.connectToNet(this.serverName, this.host, this.port, function () {
        ipc.of[this.serverName].on('connect', function () {
          deferred.resolve('Connected to ', this.serverName);
        }.bind(this));
      }.bind(this));
  }
  else {
    deferred.resolve('Already connected to server ', this.serverName);
  }

  return deferred.promise;
}

/**
 * Add a listener to a message room. Does nothing if it's already listening to that room.
 *
 * @param data
 * @param socket
 */
function addListener (data, socket) {
  if (!this.listeners[data.room]) {
    this.listeners[data.room] = {
      sockets: [],
      lastSocketSent: 0
    };
  }
  else {
    if (_.find(this.listeners[data.room].sockets, 'id', data.id) !== -1) {
      return false;
    }
  }

  this.listeners[data.room].sockets.push({id: data.id, socket: socket});
}

/**
 * Unsubscribes a listener to a message room.
 * Does nothing if the listener wasn't registered.
 *
 * @param data
 */
function removeListener (data) {
  var listenersCount = 0;

  if (this.listeners[data.room] && _.findIndex(this.listeners[data.room].sockets, 'id', data.id) !== -1) {
    listenersCount = _.size(this.listeners[data.room].sockets);

    if (listenersCount === 1) {
      delete this.listeners[data.room];
    }
    else {
      _.remove(this.listeners[data.room].sockets, {id: data.id});
      this.listeners[data.room].lastSocketSent = this.listeners[data.room].lastSocketSent % (listenersCount - 1);
    }
  }
}

/**
 * Sends a message to any of one registered listener on this message room.
 * The load balancer algorithm is at the moment very basic: it sends the message to the next listener in the list.
 *
 * @param data
 */
function sendToListeners (data) {
  var socketsLeft;

  if (this.listeners[data.room]) {
    // clean up all destroyed listeners
    _.remove(this.listeners[data.room].sockets, function (listener) {
      return listener.socket.destroyed;
    });

    if ((socketsLeft = _.size(this.listeners[data.room].sockets)) === 0) {
      delete this.listeners[data.room];
      return false;
    }

    this.listeners[data.room].lastSocketSent = Math.min(this.listeners[data.room].lastSocketSent, (socketsLeft - 1));
    this.listeners[data.room].lastSocketSent = (this.listeners[data.room].lastSocketSent + 1) % socketsLeft;

    ipc.server.emit(
      this.listeners[data.room].sockets[this.listeners[data.room].lastSocketSent].socket,
      data.room,
      data.message
    );
  }
}
