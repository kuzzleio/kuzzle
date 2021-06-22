'use strict';

const sinon = require('sinon');
const EventEmitter = require('eventemitter3');
const IORedis = require('ioredis');

const getBuiltinCommands = (new IORedis({lazyConnect: true})).getBuiltinCommands;

/**
 * @param err
 * @constructor
 */
class RedisClientMock extends EventEmitter {
  constructor (options, err) {
    super();
    this.options = options;

    this.getBuiltinCommands = getBuiltinCommands;

    getBuiltinCommands().forEach(command => {
      this[command] = sinon.stub().resolves();
    });

    this.select = sinon.spy((key, callback) => key > 16
      ? callback(new Error('Unknown database'))
      : callback(null));

    process.nextTick(() => err ? this.emit('error', err) : this.emit('ready'));
  }

  scanStream (options) {
    const Stream = function () {
      setTimeout(
        () => {
          const prefix = options && options.match
            ? options.match.replace(/[*?]/g, '')
            : 'k';
          const keys = [];

          for (let i = 0; i < 10; i++) {
            keys.push(prefix + i);
          }

          this.emit('data', keys);
          this.emit('end', true);
        },
        50);
    };
    Stream.prototype = new EventEmitter();

    return new Stream();
  }
}

module.exports = RedisClientMock;
