var
  redisCommands = (require('ioredis')()).getBuiltinCommands(),
  mock = {};

redisCommands.forEach(command => {
  mock[command] = mock[command.toUpperCase()] = function () {
    var
      args = Array.prototype.slice.call(arguments),
      callback = args[args.length - 1];

    args = args.slice(0, args.length -  1);

    callback(null, {
      result: {
        name: command,
        args: args
      }
    });

  };
});

module.exports = mock;
