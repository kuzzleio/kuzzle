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
  pm2 = require('pm2');

let
  _shutdown = 0;

/**
 * Gracefully exits after processing remaining requests
 *
 * @param {Kuzzle} kuzzle
 * @returns {Promise}
 */
function runShutdown (kuzzle) {
  // pm2.delete sends a SIGINT signal
  // we keep track of how many shutdowns are asked
  // to detect when pm2 has finished deleting Kuzzle
  // from its tasks list
  _shutdown++;

  if (_shutdown > 1) {
    return Bluebird.resolve();
  }

  kuzzle.log.info('Initiating shutdown...');

  return new Bluebird(resolve => {
    kuzzle.entryPoints.dispatch('shutdown');

    // Gives time for the proxy to receive the shutdown signal
    // and eventually to receive the last batch of requests to process
    setTimeout(() => waitRemainingRequests(kuzzle, resolve), 1000);
  });
}

function waitRemainingRequests(kuzzle, resolve) {
  const remaining = kuzzle.funnel.remainingRequests;

  if (remaining !== 0) {
    kuzzle.log.info(`Waiting: ${remaining} remaining requests`);
    return setTimeout(() => waitRemainingRequests(kuzzle, resolve), 1000);
  }

  resolve();

  pm2.list((listerr, processes) => {
    if (listerr) {
      return halt(kuzzle);
    }

    const kuzzleProcess = processes
      .filter(pm2Process => pm2Process.pid === process.pid);

    // not started with PM2 or development mode => exit immediately
    if (kuzzleProcess.length === 0 || kuzzleProcess[0].pm2_env.watch) {
      if (kuzzleProcess.length !== 0) {
        kuzzle.log.info('PM2 Watch activated: restarting Kuzzle');

        return pm2.restart(kuzzleProcess[0].pm_id);
      }

      return halt(kuzzle);
    }

    // production mode: ask PM2 to stop & delete Kuzzle to prevent
    // a restart
    pm2.delete(kuzzleProcess[0].pm_id, delerr => {
      kuzzle.log.info('PM2 failed to delete Kuzzle: ', delerr);
      kuzzle.log.info('Exiting anyway.');
    });

    // pm2.delete does not notify when deletion is finished,
    // so we use the shutdown counter to check how many
    // SIGINT signals have been received
    const interval = setInterval(() => {
      if (_shutdown > 1) {
        clearInterval(interval);
        halt(kuzzle);
      }
    }, 200);
  });
}

function halt(kuzzle) {
  kuzzle.log.info('Halted.');
  process.exit(0);
}

module.exports = runShutdown;
