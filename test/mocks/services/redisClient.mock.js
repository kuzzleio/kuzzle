var
  EventEmitter = require('eventemitter2').EventEmitter2,
  getBuiltinCommands = (require('ioredis')({lazyConnect: true})).getBuiltinCommands,
  redisCommands = getBuiltinCommands(),
  Promise = require('bluebird');

/**
 * @param err
 * @constructor
 */
function RedisClientMock (err) {
  this.getBuiltinCommands = getBuiltinCommands;

  this.scanStream = options => {
    var Stream = function () {
      setTimeout(() => {
        var
          prefix = options && options.match ? options.match.replace(/[\*\?]/g, '') : 'k',
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
  };

  redisCommands.forEach(command => {
    this[command] = this[command.toUpperCase()] = function () {
      return Promise.resolve({
        name: command,
        args: Array.prototype.slice.call(arguments)
      });
    };
  });

  this.select = this.SELECT = (key, callback) => key > 16 ? callback(new Error('Unknown database')) : callback(null);

  this.flushdb = this.FLUSHDB = callback => callback(null);

  process.nextTick(() => err ? this.emit('error', err) : this.emit('ready'));
}

RedisClientMock.prototype = new EventEmitter();

module.exports = RedisClientMock;
