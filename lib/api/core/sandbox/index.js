var
  q = require('q'),
  cp = require('child_process'),
  GatewayTimeoutError = require('../errors/gatewayTimeoutError');

function Sandbox () {
  this.timeout = 500;
  this.child = null;
}

Sandbox.prototype.maxChildId = 100;

Sandbox.prototype.run = function (data) {
  var
    deferred = q.defer(),
    timer,
    execArgv = process.execArgv.slice(),
    debugPort = process.debugPort + Sandbox.prototype.maxChildId,
    hasDebugArg = false;

  try {
    Sandbox.prototype.maxChildId++;

    execArgv.forEach((v, i) => {
      var match = v.match(/^(--debug|--debug-(brk|port))(=\d+)?$/);

      if (match) {
        execArgv[i] = match[1] + '=' + debugPort;
        hasDebugArg = true;
      }
    });

    if (!hasDebugArg) {
      execArgv = ['--debug-port=' + debugPort].concat(execArgv);
    }

    this.child = cp.fork(__dirname + '/_sandboxCode.js', [], {
      execArgv: execArgv
    });
    this.child.send(data);

    this.child.on('message', msg => {
      deferred.resolve(msg);
      this.child.kill();
      clearTimeout(timer);
    });

    timer = setTimeout(() => {
      if (this.child.connected) {
        this.child.kill();
        deferred.reject(new GatewayTimeoutError('Timeout. The sandbox did not respond within ' + this.timeout + 'ms.'));
      }
    }, this.timeout);

  }
  catch (e) {
    deferred.reject(e);
  }

  return deferred.promise;
};

module.exports = Sandbox;
