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
 * Register handlers and do a kuzzle dump for:
 * - system signals
 * - unhandled-rejection
 * - uncaught-exception
 *
 * @param {Kuzzle} kuzzle
 */
function registerSignalHandlers (kuzzle) {
  // Remove external listeners (PM2) to avoid other listeners to exit current process
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (reason, promise) => {
    if (reason !== undefined) {
      kuzzle.log.error(
        `ERROR: unhandledRejection: ${reason.message}`, reason.stack, promise);
    } else {
      kuzzle.log.error(`ERROR: unhandledRejection: ${promise}`);
    }

    // Crashing on an unhandled rejection is a good idea during development
    // as it helps spotting code errors. And according to the warning messages,
    // this is what Node.js will do automatically in future versions anyway.
    if (process.env.NODE_ENV === 'development') {
      kuzzle.log.error('Kuzzle caught an unhandled rejected promise and will shutdown.');
      kuzzle.log.error('This behavior is only triggered if NODE_ENV is set to "development"');

      throw reason;
    }
  });

  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', err => {
    kuzzle.log.error(`ERROR: uncaughtException: ${err.message}\n${err.stack}`);
    dumpAndExit(kuzzle, 'uncaught-exception');
  });

  // abnormal termination signals => generate a core dump
  for (const signal of ['SIGQUIT', 'SIGABRT']) {
    process.removeAllListeners(signal);
    process.on(signal, () => {
      kuzzle.log.error(`ERROR: Caught signal: ${signal}`);
      dumpAndExit(kuzzle, 'signal-'.concat(signal.toLowerCase()));
    });
  }

  // signal SIGTRAP is used to generate a kuzzle dump without stopping it
  process.removeAllListeners('SIGTRAP');
  process.on('SIGTRAP', () => {
    kuzzle.log.error('Caught signal SIGTRAP => generating a core dump');
    kuzzle.dump('signal-sigtrap');
  });

  // gracefully exits on normal termination
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.removeAllListeners(signal);
    process.on(signal, () => kuzzle.shutdown());
  }
}

async function dumpAndExit(kuzzle, suffix) {
  if (kuzzle.config.dump.enabled) {
    try {
      await kuzzle.dump(suffix);
    }
    catch(error) {
      // this catch is just there to prevent unhandled rejections, there is
      // nothing to do with that error
    }
  }

  await kuzzle.shutdown();
}

module.exports = { register: registerSignalHandlers };
