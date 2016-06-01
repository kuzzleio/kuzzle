var
  sinon = require('sinon'),
  util = require('util'),
  EventEmitter = require('events');

function WSMock (server) {
  this.server = server;
  this.listeners = {};

  // by calling process nextick, we allow the parent call to attach its own events in time
  process.nextTick(() => this.server.emit('connection', this));

  this.on = (event, cb) => {
    cb = sinon.spy(cb);

    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(cb);

    return EventEmitter.prototype.on.call(this, event, cb);
  };
  this.on = sinon.spy(this, 'on');
  this.once = sinon.spy(this, 'once');

  this.close = sinon.spy();

  this.send = sinon.spy(data => {
    this.emit('message', data);
  });

}

util.inherits(WSMock, EventEmitter);

module.exports = WSMock;
