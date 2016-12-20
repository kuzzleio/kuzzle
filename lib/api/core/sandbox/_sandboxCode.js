var vm = require('vm');

process.on('message', data => {
  var
    sandbox = {},
    sandboxContext,
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
    sandboxContext = vm.createContext(sandbox);
    script = new vm.Script(data.code);

    result = script.runInContext(sandboxContext);

    process.send({
      result: result,
      context: sandboxContext
    });
  }
  catch (e) {

    if (e.name === 'SyntaxError') {
      process.send({
        error: 'Error running sandbox code',
        err: {
          name: e.name,
          message: e.message,
          stack: e.stack
        }
      });
    }
    else {
      process.send({
        result: true,
        context: {}
      });
    }
  }
});
