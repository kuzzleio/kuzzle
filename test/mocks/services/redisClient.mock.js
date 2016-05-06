var
  redisCommands = (require('ioredis')()).getBuiltinCommands(),
  q = require('q'),
  mock = {};

redisCommands.forEach(command => {
  mock[command] = mock[command.toUpperCase()] = function () {
    return q({
      name: command,
      args: Array.prototype.slice.call(arguments)
    });
  };
});

module.exports = mock;
