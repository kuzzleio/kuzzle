var
  EventEmitter = require('eventemitter2').EventEmitter2,
  redisCommands = (require('ioredis')({lazyConnect: true})).getBuiltinCommands(),
  Promise = require('bluebird'),
  mock = {};

redisCommands.forEach(command => {
  mock[command] = mock[command.toUpperCase()] = function () {
    return Promise.resolve({
      name: command,
      args: Array.prototype.slice.call(arguments)
    });
  };
});

mock.scanStream = function (options) {
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

module.exports = mock;
