/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  fs = require('fs');

module.exports = {

  /**
   * Write a PID file for Kuzzle
   *
   * @param {KuzzleConfiguration} config
   * @returns {Promise}
   */
  writePidFile: config => {
    return new Bluebird((resolve, reject) => {
      fs.writeFile(config.server.pidFile, process.pid.toString(), error => {
        if (error) {
          reject(error);
        }

        resolve(error);
      });
    });
  },

  /**
   * Delete Kuzzle PID file
   *
   * @param {KuzzleConfiguration} config
   * @returns {Promise}
   */
  deletePidFile: config => {
    return new Bluebird((resolve, reject) => {
      fs.unlink(config.server.pidFile, error => {
        if (error) {
          reject(error);
        }

        resolve();
      });
    });
  },

  /**
   * Read Kuzzle PID from PID file
   *
   * @param {KuzzleConfiguration} config
   * @returns {Promise<int>}
   */
  readPidFile: config => {
    return new Bluebird((resolve, reject) => {
      fs.readFile(config.server.pidFile, (error, content) => {
        if (error) {
          reject(error);
        }

        const pid = parseInt(content, 10);

        if (isNaN(pid)) {
          reject(new InternalError(`${content} is not a valid PID`));
        }

        resolve(pid);
      });
    });
  }
};
