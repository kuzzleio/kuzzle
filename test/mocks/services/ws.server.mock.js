var
  sinon = require('sinon'),
  util = require('util'),
  EventEmitter = require('events');

/**
 * @constructor
 */
function WSServerMock () {
  this.clients = [];
  this.listeners = { };

  this.close = sinon.spy(() => {
    this.clients.forEach(client => {
      client.emit('close');
    });
  });

  this.once = sinon.spy(this, 'once');

  this.on = (event, cb) => {
    cb = sinon.spy(cb);

    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(cb);

    return EventEmitter.prototype.on.call(this, event, cb);
  };
  this.on = sinon.spy(this, 'on');

  this.on('connection', client => {
    var idx = this.clients.indexOf(client);

    if (idx === -1) {
      this.clients.push(client);
      client.emit('open', true);
    }
  });
}


util.inherits(WSServerMock, EventEmitter);

module.exports = WSServerMock;
