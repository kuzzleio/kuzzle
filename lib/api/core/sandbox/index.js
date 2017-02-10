'use strict';

const
  Promise = require('bluebird'),
  cp = require('child_process'),
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
  let opts = options || {};

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
  let timer;

  if (this.child !== null && this.child.connected) {
    return Promise.reject(new InternalError('A process is already running for this sandbox'));
  }

  return new Promise((resolve, reject) => {
    try {
      this.child = cp.fork(__dirname + '/_sandboxCode.js');

      this.child.on('message', msg => {
        resolve(msg);
        this.child.kill();
        clearTimeout(timer);
      });

      this.child.on('error', err => {
        reject(err);
        this.child.kill();
        clearTimeout(timer);
      });

      this.child.send(data);

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
};

module.exports = Sandbox;
