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
  pm2 = require('pm2');

let
  _kuzzle,
  _shutdown = 0;

/**
 * Gracefully exits after processing remaining requests
 *
 * @param {Request} request - UNUSED
 * @param {Function} statusUpdate
 * @returns {Promise}
 */
// eslint-disable-next-line no-console
function cliRunShutdown (request, statusUpdate = console.log) {
  // pm2.delete sends a SIGINT signal
  // we keep track of how many shutdowns are asked
  // to detect when pm2 has finished deleting Kuzzle
  // from its tasks list
  _shutdown++;

  if (_shutdown > 1) {
    return Bluebird.resolve();
  }

  statusUpdate('Initiating shutdown...');

  return new Bluebird(resolve => {
    _kuzzle.entryPoints.dispatch('shutdown');

    // Gives time for the proxy to receive the shutdown signal
    // and eventually to receive the last batch of requests to process
    setTimeout(() => waitRemainingRequests(resolve, statusUpdate), 1000);
  });
}

function waitRemainingRequests(resolve, statusUpdate) {
  const remaining = _kuzzle.funnel.remainingRequests;

  if (remaining !== 0) {
    statusUpdate(`Waiting: ${remaining} remaining requests`);
    return setTimeout(() => waitRemainingRequests(resolve, statusUpdate), 1000);
  }

  resolve();

  pm2.list((listerr, processes) => {
    if (listerr) {
      return halt(statusUpdate);
    }

    const kuzzleProcess = processes
      .filter(pm2Process => pm2Process.pid === process.pid);

    // not started with PM2 or development mode => exit immediately
    if (kuzzleProcess.length === 0 || kuzzleProcess[0].pm2_env.watch) {
      if (kuzzleProcess.length !== 0) {
        statusUpdate('PM2 Watch activated: restarting Kuzzle');

        return pm2.restart(kuzzleProcess[0].pm_id);
      }

      return halt(statusUpdate);
    }

    // production mode: ask PM2 to stop & delete Kuzzle to prevent
    // a restart
    pm2.delete(kuzzleProcess[0].pm_id, delerr => {
      statusUpdate('PM2 failed to delete Kuzzle: ', delerr);
      statusUpdate('Exiting anyway.');
    });

    // pm2.delete does not notify when deletion is finished,
    // so we use the shutdown counter to check how many
    // SIGINT signals have been received
    const interval = setInterval(() => {
      if (_shutdown > 1) {
        clearInterval(interval);
        halt(statusUpdate);
      }
    }, 200);
  });
}

function halt(statusUpdate) {
  statusUpdate('Halted.');
  process.exit(0);
}

module.exports = function cliShutdown (kuzzle) {
  _kuzzle = kuzzle;
  return cliRunShutdown;
};
