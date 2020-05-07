/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

/**
 * Gracefully exits after processing remaining requests
 *
 * @param {Kuzzle} kuzzle
 * @returns {Promise}
 */
function shutdown (kuzzle) {
  kuzzle.log.info('Initiating shutdown...');
  kuzzle.emit('core:shutdown');

  // Ask the network layer to stop accepting new request
  kuzzle.entryPoints.dispatch('shutdown');

  waitRemainingRequests(kuzzle);
}

function waitRemainingRequests(kuzzle) {
  const remaining = kuzzle.funnel.remainingRequests;

  if (remaining !== 0) {
    kuzzle.log.info(`[shutdown] Waiting: ${remaining} remaining requests`);
    setTimeout(() => waitRemainingRequests(kuzzle), 1000);
    return;
  }

  kuzzle.log.info('Halted.');
  process.exit(0);
}

module.exports = shutdown;
