const
  sinon = require('sinon'),
  EventEmitter = require('events');

/**
 * @param server
 * @constructor
 */
class WSMock extends EventEmitter {
  constructor(server) {
    super();
    this.server = server;
    this.__events = {};

    // by calling process nextick, we allow the parent call to attach its own events in time
    if (this.server) {
      process.nextTick(() => {
        this.server.emit('connection', this);
      });
    } else {
      process.nextTick(() => {
        this.emit('error', new Error('no WS server found'));
      });
    }

    this.on = (event, cb) => {
      cb = sinon.spy(cb);

      if (!this.__events[event]) {
        this.__events[event] = [];
      }
      this.__events[event].push(cb);

      return EventEmitter.prototype.on.call(this, event, cb);
    };
    this.on = sinon.spy(this, 'on');
    this.once = sinon.spy(this, 'once');

    this.close = sinon.spy();

    this.ping = sinon.spy();

    this.send = sinon.spy();

    this.retryConnection = sinon.spy();
  }
}

module.exports = WSMock;
