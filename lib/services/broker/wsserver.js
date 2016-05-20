var
  async = require('async'),
  q = require('q'),
  CircularList = require('easy-circular-list'),
  WS = require('ws').Server,
  _kuzzle;

function WSServer (kuzzle) {
  this.server = null;
  this.rooms = {};
  this.handlers = {};

  this.options = {
    server: {
      port: kuzzle.config.broker.port,
      perMessageDeflate: false
    }
  };

  _kuzzle = kuzzle;
}

WSServer.prototype.init = function () {
  var
    deferred = q.defer();

  this.server = new WS(this.options.server, () => {
    deferred.resolve();
  });

  this.server.on('connection', clientSocket => {
    clientSocket.on('message', msg => {
      msg = JSON.parse(msg);

      if (msg.room && this.handlers[msg.room]) {
        this.handlers[msg.room].forEach(cb => cb(msg));
      }

      switch (msg.action) {
        case 'listen':
          if (this.rooms[msg.room] === undefined) {
            this.rooms[msg.room] = new CircularList([]);
          }
          if (this.rooms[msg.room].getArray().indexOf(clientSocket) === -1) {
            this.rooms[msg.room].add(clientSocket);
          }
          break;
        case 'send':
          this.send(msg.room, msg.data);
          break;
        case 'broadcast':
          this.broadcast(msg.room, msg.data);
          break;
      }
    });

    clientSocket.on('close', (code, message) => {
      _kuzzle.pluginsManager.trigger('log:info', `client disconnected [${code}] ${message}`);
      removeClient.call(this, clientSocket);
    });

    clientSocket.on('error', err => {
      _kuzzle.pluginsManager.trigger('log:error', err);
    });
  });

  return deferred.promise;
};

WSServer.prototype.broadcast = function (room, data) {
  if (!this.rooms[room]) {
    return;
  }

  async.each(
    this.rooms[room].getArray(),
    clientSocket => {
      clientSocket.send(JSON.stringify({
        action: 'send',
        room: room,
        data: data
      }));
    },
    err => {
      if (err) {
        _kuzzle.pluginsManager.trigger('log:error', err);
      }
    });
};

WSServer.prototype.send = function (room, data) {
  if (!this.rooms[room]) {
    return;
  }

  this.rooms[room].getNext().send(JSON.stringify({
    action: 'send',
    room: room,
    data: data
  }));
};

WSServer.prototype.listen = function (room, cb) {
  if (this.handlers[room] === undefined) {
    this.handlers[room] = [];
  }
  this.handlers[room].push(cb);
};

WSServer.prototype.waitForClients = function (room) {
  var
    deferred,
    interval;

  if (this.rooms[room]) {
    return q();
  }

  deferred = q.defer();

  interval = setInterval(() => {
    if (this.rooms[room]) {
      deferred.resolve();
      clearInterval(interval);
    }
  }, 100);

  return deferred.promise;
};

WSServer.prototype.close = function () {
  this.server.close();
  this.server = null;
};


module.exports = WSServer;

function removeClient (clientSocket) {
  clientSocket.close();

  Object.keys(this.rooms).forEach(room => {
    this.rooms[room].remove(clientSocket);
    if (this.rooms[room].getSize() === 0) {
      delete this.rooms[room];
    }
  });
}
