/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  Bluebird = require('bluebird'),
  cp = require('child_process'),
  errorsManager = require('../../../config/error-codes/throw');

/**
 * @deprecated
 * Constructor.
 * options:
 *   * timeout: time after which the sandboxed code is consider to have timed out.
 *
 * @class Sandbox
 * @param {object} [options]
 */
class Sandbox {
  constructor(options = {}) {
    this.timeout = options.timeout || 500;
    this.child = null;
  }

  /**
   * Executes the given code in a sandbox.
   *
   * @param {object} data {sandbox: {myVar: myValue}, code: 'myVar++'}}
   * @returns {Promise}
   */
  run(data) {
    if (this.child !== null && this.child.connected) {
      return Bluebird.reject(errorsManager.getError(
        'internal',
        'sandbox',
        'process_already_running'));
    }

    return new Bluebird((resolve, reject) => {
      try {
        let timer;

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
            reject(errorsManager.getError(
              'internal',
              'sandbox',
              'timeout',
              this.timeout));
          }
        }, this.timeout);
      } catch (e) {
        reject(e);
      }
    });
  }
}

module.exports = Sandbox;
