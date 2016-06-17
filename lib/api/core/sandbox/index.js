var
  q = require('q'),
  cp = require('child_process'),
  portfinder = require('portfinder'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  GatewayTimeoutError = require('kuzzle-common-objects').Errors.gatewayTimeoutError;

/**
 * Constructor.
 * options:
 *   * timeout: time after which the sandboxed code is consider to have timed out.
 *
 * @param {Object} options
 * @constructor
 */
function Sandbox (options) {
  var opts = options || {};

  this.timeout = opts.timeout || 500;
  this.child = null;
}


/**
 * Executes the given code in a sandbox.
 *
 * @param {Object} data {sandbox: {myVar: myValue}, code: 'myVar++'}}
 * @returns {Promise}
 */
Sandbox.prototype.run = function (data) {
  if (this.child !== null && this.child.connected) {
    return q.reject(new InternalError('A process is already running for this sandbox'));
  }

  return (() => {
    var
      deferred,
      execArgv = process.execArgv.slice();

    if (process.debugPort) {
      deferred = q.defer();

      portfinder.getPort((err, debugPort) => {
        execArgv.forEach((v, i) => {
          var match = v.match(/^(--debug|--debug-(brk|port))(=\d+)?$/);

          if (match) {
            execArgv[i] = match[1] + '=' + debugPort;
          }
        });

        deferred.resolve(execArgv);
      });

      return deferred.promise;
    }

    return q(execArgv);
  })()
    .then(execArgv => {
      var
        deferred = q.defer(),
        timer;

      try {

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
        return q.reject(e);
      }

      return deferred.promise;
    });


};

module.exports = Sandbox;
