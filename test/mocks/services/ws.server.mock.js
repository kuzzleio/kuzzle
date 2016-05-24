var
  sinon = require('sinon'),
  util = require('util'),
  EventEmitter = require('events');

function WSServerMock () {
  this.clients = [];

  this.close = sinon.stub();

  this.once = sinon.spy(this, 'once');
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
