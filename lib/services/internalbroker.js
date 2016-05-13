var
  InternalError = require('../api/core/errors/internalError'),
  q = require('q'),
  util = require('util'),
  uuid = require('node-uuid'),
  _ = require('lodash'),
  Service = require('./service'),
  WsClient = require('ws'),
  WsServer = require('ws').Server;

/**
 * Internal message broker, used by Kuzzle to establish communication between its components.
 * This module registers local and distant listeners using 2 distinct strategies:
 *    - direct callback calls for listeners registered from inside the instance itself
 *    - tcp emissions for distant listeners (usually workers)
 *
 * Currently, listeners are assumed to be load balanced, meaning that when a message is to be dispatched to a
 * given room, the internal broker will elect a listener and send the message to it.
 *
 * @param {Object} kuzzle kuzzle instance
 * @param {Object} options used to start the service
 */
function InternalBroker (kuzzle, options) {
  this.kuzzle = kuzzle;
  this.isServer = options.isServer;
  this.server = null;
  this.client = {
    socket: null,
    connected: null,
    state: 'disconnected',
    retryInterval: 1000
  };
  this.host = kuzzle.config.broker.host;
  this.port = kuzzle.config.broker.port;
  this.uuid = uuid.v4();
  this.rooms = {};

  Object.defineProperties(this, {
    settings: {
      writable: true,
      value: {
        service: options.service
      }
    }
  });


  /**
   * Initialize the internal broker service
   * @return Promise when initialization is complete
   */
  this.init = function () {
    return (this.isServer) ? serverStart.call(this) : clientConnect.call(this);
  };

  /**
   * Sends data to a room
   *
   * @param {string} room to send message to
   * @param {object} data content to forward to listeners
   */
  this.add = function (room, data) {
    if (this.isServer) {
      sendToListeners.call(this, room, data);
    }
    else {
      clientConnect.call(this)
        .then(function (ws) {
          ws.send(JSON.stringify({action: 'send', room: room, data: data}));
        });
    }
  };

  /**
   * Sends data to all listeners of a room
   *
   * @param {string} room to send message to
   * @param {object} data content to forward to listeners
   */
  this.broadcast = function (room, data) {
    if (this.isServer) {
      sendToAllListeners.call(this, room, data);
    }
    else {
      clientConnect.call(this)
        .then(function (ws) {
          ws.send(JSON.stringify({action: 'broadcast', room: room, data: data}));
        });
    }
  };

  /**
   * Listens to a specific room and execute a callback for each messages
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   */
  this.listen = function (room, onListenCB) {
    if (!this.isServer) {
      clientConnect.call(this)
        .then(function (ws) {
          /*
           We add the listener to the list only after connecting to the server,
           because the client will try to re-register every known listeners when a
           connection has been established.
            */
          addListener.call(this, room, onListenCB, this.uuid);
          ws.send(JSON.stringify({action: 'listen', room: room}));
        }.bind(this));
    }
    else {
      addListener.call(this, room, onListenCB, this.uuid);
    }
  };

  /**
   * Listen to a specific room and execute a callback once a message is received.
   * Destroys the listener after the first message is consumed.
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   */
  this.listenOnce = function (room, onListenCB) {
    if (!this.isServer) {
      clientConnect.call(this)
        .then(function (ws) {
          /*
           We add the listener to the list only after connecting to the server,
           because the client will try to re-register every known listeners when a
           connection has been established.
           */
          addListener.call(this, room, onListenCB, this.uuid, {destroyOnUse: true});
          ws.send(JSON.stringify({action: 'listenOnce', room: room}));
        }.bind(this));
    }
    else {
      addListener.call(this, room, onListenCB, this.uuid, {destroyOnUse: true});
    }
  };

  /**
   * Returns a promise that is resolved only when at least one listener has registered on the given room.
   *
   * @param {String} room
   * @returns {Promise}
   */
  this.waitForListeners = function (room) {
    var
      deferred = q.defer(),
      intervalID;

    intervalID = setInterval(() => {
      cleanRoomListeners.call(this, room);

      if (this.rooms[room]) {
        deferred.resolve();
        clearInterval(intervalID);
      }
    }, 100);

    return deferred.promise;
  };

  /**
   * Close the current client connection or shutdown the websocket server
   * If closing a client connection, the connection handler will try to reconnect automatically
   */
  this.close = function () {
    if (this.client.socket) {
      if (this.client.state === 'connected') {
        this.client.state = 'disconnected';
        this.client.socket.close();
        this.client.socket = null;
        this.client.connected = null;
      }
    }

    if (this.isServer) {
      this.server.close();
      this.server = null;
    }
  };
}

util.inherits(InternalBroker, Service);

module.exports = InternalBroker;

/**
 * Start a new websocket server on ws://host:port URL configured at Kuzzle startup.
 * Should only be invoked by Kuzzle main instances, not by its workers.
 * Only 1 server possible on a given URL address.
 *
 * @returns {Promise} Resolved when the websocket server is ready to accept connections
 */
function serverStart () {
  var deferred = q.defer();

  if (this.server) {
    deferred.reject(new InternalError('Websocket server already started'));
    return deferred.promise;
  }

  this.server = new WsServer({port: this.port, perMessageDeflate: false}, function () {
    this.kuzzle.pluginsManager.trigger('internalBroker:started', 'Internal broker server started');
    deferred.resolve('Internal broker server started');
  }.bind(this));

  // Received when a new client connects to the server
  this.server.on('connection', function (ws) {
    var clientUUID = uuid.v1();

    // Adds a message handler for this client.
    ws.on('message', function (payload) {
      handleSocketMessage.call(this, ws, clientUUID, JSON.parse(payload));
    }.bind(this));
  }.bind(this));

  return deferred.promise;
}

/**
 * Initializes a connection to the socket server, if not already created
 * Automatically reconnect on socket close or on error.
 * Retries indefinitly until a connection to the server is established.
 *
 * @returns promise
 */
function clientConnect() {
  if (this.client.state === 'pending' || this.client.state === 'connected') {
    return this.client.connected.promise;
  }

  this.client.state = 'pending';

  if (!this.client.connected) {
    this.client.connected = q.defer();
  }

  this.client.socket = new WsClient('ws://' + this.host + ':' + this.port, {perMessageDeflate: false});

  this.client.socket.on('open', function () {
    this.kuzzle.pluginsManager.trigger('internalBroker:connected', 'Connected to Kuzzle server');
    this.client.state = 'connected';

    /*
    Re-register all known listeners. Allow to cleanly restore the previous client state
     in case we temporarily lose the connection to the server.
     */
    Object.keys(this.rooms).forEach(function (room) {
      this.kuzzle.pluginsManager.trigger('internalBroker:reregistering', 'Re-registering room: ' + room);
      _.forEach(this.rooms[room].listeners, function (l) {
        if (!l.destroyOnUse) {
          this.client.socket.send(JSON.stringify({action: 'listen', room: room}));
        }
        else {
          this.client.socket.send(JSON.stringify({action: 'listenOnce', room: room}));
        }
      }.bind(this));
    }.bind(this));

    this.client.connected.resolve(this.client.socket);
  }.bind(this));

  this.client.socket.on('message', function (payload) {
    handleSocketMessage.call(this, this.client.socket, this.uuid, JSON.parse(payload));
  }.bind(this));

  this.client.socket.on('error', function (e) {
    this.close();

    this.kuzzle.pluginsManager.trigger('log:error',
      'Error while trying to connect to ws://' + this.host + ':' + this.port + ': ' + e.message + '\n' +
      '==> RECONNECTING IN ' + this.client.retryInterval + 'ms'
    );

    this.kuzzle.pluginsManager.trigger('internalBroker:error', {host: this.host, port: this.port, message: e.message, retry: this.client.retryInterval});

    this.client.state = 'retrying';

    setTimeout(function () {
      clientConnect.call(this);
    }.bind(this), this.client.retryInterval);

  }.bind(this));

  this.client.socket.on('close', function (code) {
    // Automatically reconnect except if this.close() was called
    if (this.client.state === 'disconnected') {
      return false;
    }

    this.close();

    this.kuzzle.pluginsManager.trigger('internalBroker:socketClosed',
      'Socket closed with code ' + code + '\n' +
      '==> RECONNECTING IN ' + this.client.retryInterval + 'ms'
    );

    setTimeout(function () {
      clientConnect.call(this);
    }.bind(this), this.client.retryInterval);

  }.bind(this));

  return this.client.connected.promise;
}

/**
 * Add a listener to a message room. Does nothing if it's already listening to that room.
 *
 * @param {object} room name
 * @param {object} listener is either a callback or a websocket listening to the room
 * @param {string} clientId ensures that there is only 1 listener per room and per client
 * @param {object} options (optional)
 */
function addListener (room, listener, clientId, options) {
  if (typeof listener !== 'function' && !(listener && listener.send && typeof listener.send === 'function')) {
    return false;
  }

  if (!this.rooms[room]) {
    this.rooms[room] = {
      listeners: [],
      lastListener: 0
    };
  }
  else if (_.findIndex(this.rooms[room].listeners, o => o.id === clientId) !== -1) {
    return false;
  }

  this.rooms[room].listeners.push(_.extend({id: clientId, listener: listener}, options));
}

/**
 * Sends a message to any of one registered listener on this message room.
 * The load balancer algorithm is at the moment a simple round-robin
 *
 * @param room
 * @param data
 */
function sendToListeners (room, data) {
  var listener;

  cleanRoomListeners.call(this, room);

  if (this.rooms[room]) {
    this.rooms[room].lastListener = (this.rooms[room].lastListener + 1) % _.size(this.rooms[room].listeners);
    listener = this.rooms[room].listeners[this.rooms[room].lastListener].listener;

    if (typeof listener === 'function') {
      listener(data);
    }
    else {
      listener.send(JSON.stringify({action: 'send', room: room, data: data}));
    }

    if (this.rooms[room].listeners[this.rooms[room].lastListener].destroyOnUse) {
      if (this.rooms[room].listeners.length === 1) {
        delete this.rooms[room];
      }
      else {
        this.rooms[room].listeners.splice(this.rooms[room].lastListener, 1);
        this.rooms[room].lastListener = Math.min(this.rooms[room].lastListener, this.rooms[room].listeners.length);
      }
    }
  }
}

/**
 * Broadcasts a message to all registered listener on this message room, listenOnce listeners excepted
 *
 * @param room
 * @param data
 */
function sendToAllListeners (room, data) {
  if (this.rooms[room]) {
    cleanRoomListeners.call(this, room);
    _.forEach(this.rooms[room].listeners, function (l) {
      if (!l.destroyOnUse) {
        if (typeof l.listener === 'function') {
          l.listener(data);
        }
        else {
          l.listener.send(JSON.stringify({action: 'send', room: room, data: data}));
        }
      }
    });
  }
}

/**
 * Handles incoming messages depending of there .action property
 * The payload is expected to contain at least:
 *    - a room name
 *    - an action to perform (send, broadcast, listen, listenOnce)
 *
 * The action option dictate the handler behavior:
 *    send: forward the message to one of the registered listeners
 *    broadcast: broadcast to ALL room's listeners instead of picking one of them
 *    listen: adds the client websocket/callback to the room's listeners
 *    listenOnce: adds the client websocket/callback to the room's listeners and destroy it after the first
 *                received message
 *
 * @param socket
 * @param clientId
 * @param msg
 */
function handleSocketMessage(socket, clientId, msg) {
  switch (msg.action) {
    case 'send':
      sendToListeners.call(this, msg.room, msg.data);
      break;
    case 'broadcast':
      sendToAllListeners.call(this, msg.room, msg.data);
      break;
    case 'listen':
      addListener.call(this, msg.room, socket, clientId);
      break;
    case 'listenOnce':
      addListener.call(this, msg.room, socket, clientId, {destroyOnUse: true});
      break;
  }
}

/**
 * clean up destroyed listeners
 *
 * @param room name
 */
function cleanRoomListeners(room) {
  if (!this.rooms[room]) {
    return false;
  }

  _.remove(this.rooms[room].listeners, function (l) {
    return ((typeof l.listener !== 'function') && !l.listener._socket);
  });

  if (this.rooms[room].listeners.length === 0) {
    delete this.rooms[room];
    return false;
  }

  this.rooms[room].lastListener = Math.min(this.rooms[room].lastListener, this.rooms[room].listeners.length - 1);
}
