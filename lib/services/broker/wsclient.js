var
  q = require('q'),
  WS = require('ws'),
  _kuzzle;

function WSClient (kuzzle) {
  _kuzzle = kuzzle;

  this.client = {
    socket: null,
    connected: null,
    state: 'disconnected',
    retryInterval: 1000
  };
  this.server = {
    host: kuzzle.config.broker.host,
    port: kuzzle.config.broker.port
  };
  this.handlers = {};
}

WSClient.prototype.init = WSClient.prototype.client = function () {
  if (this.client.connected) {
    return this.client.connected;
  }

  this.client.connected = q.defer();
  this.client.state = 'pending';

  this.client.socket = new WS(`ws://${this.server.host}:${this.server.port}`, {perMessageDeflate: false});

  this.client.socket.on('message', msg => {
    msg = JSON.parse(msg);

    if (msg.room && this.handlers[msg.room]) {
      this.handlers[msg.room].forEach(cb => cb(msg.data));
    }
  });

  this.client.socket.on('open', () => {
    _kuzzle.pluginsManager.trigger('internalBroker:connected', 'Connected to Kuzzle server');

    // if we were already listening to some rooms, subscribe again to the server
    Object.keys(this.handlers).forEach(room => {
      _kuzzle.pluginsManager.trigger('internalBroker:reregistering', 'Re-registering room: ' + room);

      this.client.socket.send(JSON.stringify({
        action: 'listen',
        room: room
      }));
    });

    this.client.state = 'connected';
    return this.client.connected.resolve(this.client.socket);
  });

  this.client.socket.on('close', code => {
    // Automatically reconnect except if this.close() was called
    if (this.client.state === 'disconnected') {
      return false;
    }

    this.close();

    _kuzzle.pluginsManager.trigger('internalBroker:socketClosed',
      `Socket closed with code ${code}
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );

    setTimeout(() => {
      this.client();
    }, this.client.retryInterval);
  });

  this.client.socket.on('error', err => {
    this.close();

    _kuzzle.pluginsManager.trigger('log:error',
      `Error while trying to connect to ws://${this.server.host}:${this.server.port} [${err.message}]
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );
    _kuzzle.pluginsManager.trigger('internalBroker:error', {host: this.server.host, port: this.server.port, message: err.message, retry: this.client.retryInterval});

    this.client.state = 'retrying';

    setTimeout(() => {
      this.client();
    }, this.client.retryInterval);

  });

  return this.client.connected.promise;
};

WSClient.prototype.listen = function (room, cb) {
  if (this.handlers[room] === undefined) {
    this.handlers[room] = [];
  }
  this.handlers[room].push(cb);
  this.client.socket.send(JSON.stringify({
    action: 'listen',
    room: room
  }));
};

WSClient.prototype.close = function () {
  if (this.client.socket) {
    if (this.client.state === 'connected') {
      this.client.state = 'disconnected';
      this.client.socket.close();
      this.client.socket = null;
      this.client.connected = null;
    }
  }
};

WSClient.prototype.broadcast = WSClient.prototype.send = function (room, msg) {
  return this.client.socket.send(JSON.stringify({
    action: 'send',
    room: msg.room,
    data: msg.data
  }));
};

module.exports = WSClient;


