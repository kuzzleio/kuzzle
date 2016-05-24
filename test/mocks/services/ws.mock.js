var
  sinon = require('sinon'),
  util = require('util'),
  EventEmitter = require('events');

function WSMock (server) {
  this.server = server;

  // by calling process nextick, we allow the parent call to attach its own events in time
  process.nextTick(() => this.server.emit('connection', this));

  this.on = sinon.spy(this, 'on');
  this.once = sinon.spy(this, 'once');

  this.close = sinon.spy((code, message) => {
    this.emit('close', code, message);
  });

  this.send = sinon.spy(data => {
    this.emit('message', data);
  });

}

util.inherits(WSMock, EventEmitter);

module.exports = WSMock;
