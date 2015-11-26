var
  vm = require('vm');

process.on('message', function (data) {
  var
    sandbox = {},
    context,
    script,
    result;

  if (data.sandbox !== undefined) {
    sandbox = data.sandbox;
  }

  if (data.code === undefined) {
    process.send({
      error: 'No code given'
    });
  }

  try {
    context = vm.createContext(sandbox);
    script = new vm.Script(data.code);

    result = script.runInContext(context);

    process.send({
      result: result,
      context: context
    });
  }
  catch (e) {
    process.send({
      error: 'Error running sandbox code',
      err: {
        name: e.name,
        message: e.message,
        stack: e.stack
      }
    });
  }
});
