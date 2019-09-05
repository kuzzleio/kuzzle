const
  sinon = require('sinon'),
  EventEmitter = require('eventemitter3'),
  IORedis = require('ioredis'),
  getBuiltinCommands = (new IORedis({lazyConnect: true})).getBuiltinCommands,
  Bluebird = require('bluebird');

/**
 * @param err
 * @constructor
 */
class RedisClientMock extends EventEmitter {
  constructor (err) {
    super();

    this.getBuiltinCommands = getBuiltinCommands;

    getBuiltinCommands().forEach(command => {
      this[command] = this[command.toUpperCase()] = function (...args) {
        return Bluebird.resolve({
          name: command,
          args: Array.prototype.slice.call(args)
        });
      };
    });

    this.select = this.SELECT = sinon.spy((key, callback) => key > 16
      ? callback(new Error('Unknown database'))
      : callback(null));

    this.flushdb = this.FLUSHDB = sinon.spy(callback => callback(null));

    process.nextTick(() => err ? this.emit('error', err) : this.emit('ready'));
  }

  scanStream (options) {
    const Stream = function () {
      setTimeout(() => {
        var
          prefix = options && options.match ? options.match.replace(/[*?]/g, '') : 'k',
          i,
          keys = [];

        for (i=0; i < 10; i++) {
          keys.push(prefix + i);
        }

        this.emit('data', keys);
        this.emit('end', true);
      }, 50);
    };
    Stream.prototype = new EventEmitter();

    return new Stream();
  }
}

module.exports = RedisClientMock;
