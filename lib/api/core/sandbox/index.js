var
  Promise = require('bluebird'),
  cp = require('child_process'),
  portfinder = require('portfinder'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  GatewayTimeoutError = require('kuzzle-common-objects').errors.GatewayTimeoutError;

/**
 * Constructor.
 * options:
 *   * timeout: time after which the sandboxed code is consider to have timed out.
 *
 * @param {object} options
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
 * @param {object} data {sandbox: {myVar: myValue}, code: 'myVar++'}}
 * @returns {Promise}
 */
Sandbox.prototype.run = function sandboxRun (data) {
  if (this.child !== null && this.child.connected) {
    return Promise.reject(new InternalError('A process is already running for this sandbox'));
  }

  return (() => {
    var
      execArgv = process.execArgv.slice();


    if (process.debugPort) {
      return new Promise(resolve => {
        portfinder.getPort((err, debugPort) => {
          execArgv.forEach((v, i) => {
            var match = v.match(/^(--debug|--debug-(brk|port))(=\d+)?$/);

            if (match) {
              execArgv[i] = match[1] + '=' + debugPort;
            }
          });

          resolve(execArgv);
        });
      });
    }

    return Promise.resolve(execArgv);
  })()
    .then(execArgv => {
      var
        timer;

      return new Promise((resolve, reject) => {
        try {
          this.child = cp.fork(__dirname + '/_sandboxCode.js', [], {
            execArgv: execArgv
          });
          this.child.send(data);

          this.child.on('message', msg => {
            resolve(msg);
            this.child.kill();
            clearTimeout(timer);
          });

          timer = setTimeout(() => {
            if (this.child.connected) {
              this.child.kill();
              reject(new GatewayTimeoutError('Timeout. The sandbox did not respond within ' + this.timeout + 'ms.'));
            }
          }, this.timeout);

        }
        catch (e) {
          reject(e);
        }
      });
    });


};

module.exports = Sandbox;
