var
  async = require('async'),
  uuid = require('node-uuid'),
  q = require('q'),
  captainsLog = require('captains-log'),
  url = require('url'),
  ipc = require('node-ipc');

module.exports = broker =  {
  serverName: 'kuzzle',
  log: captainsLog(),
  kuzzleConfig: null,
  host: null,
  port: null,
  connected: null,

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
    ipc.config.id = this.serverName;

    ipc.serveNet(this.host, this.port, function () {
      ipc.server.on('dispatch', function (data) {
        ipc.server.broadcast(data.room, data.message);
      });
    }.bind(this));

    ipc.server.start();
  },

  /**
   * Sends data to a room
   * @param room
   * @param data object that must be insert in queue
   */
  add: function (room, data) {
    connect.call(this).then(function () {
      ipc.of[this.serverName].emit('dispatch', { room: room, message: data });
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
