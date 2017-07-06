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

/* eslint-disable no-console */

const
  rc = require('rc'),
  params = rc('kuzzle'),
  readlineSync = require('readline-sync'),
  clc = require('cli-color');

function commandClearCache (database, options) {
  let
    opts = options,
    db = database,
    userIsSure;

  if (options === undefined) {
    opts = database;
    db = null;
  }

  const data = {database: db};

  const error = string => opts.parent.noColors ? string : clc.red(string);
  const warn = string => opts.parent.noColors ? string : clc.yellow(string);
  const notice = string => opts.parent.noColors ? string : clc.cyanBright(string);
  const ok = string => opts.parent.noColors ? string: clc.green.bold(string);
  const question = string => opts.parent.noColors ? string : clc.whiteBright(string);

  if (db === 'memoryStorage') {
    console.log(warn('[ℹ] You are about to clear Kuzzle memoryStorage database.'));
    console.log(warn('[ℹ] This operation cannot be undone.\n'));
    userIsSure = params.noint || readlineSync.question('[❓] Are you sure? If so, please type "I am sure" (if not just press [Enter]): ') === 'I am sure';
  } else {
    userIsSure = readlineSync.keyInYN(question('[❓] Do you want to clear Kuzzle internal cache?'));
  }

  if (userIsSure) {
    const kuzzle = new (require('../../lib/api/kuzzle'))();

    console.log(notice('[ℹ] Processing...\n'));
    return kuzzle.cli.doAction('clearCache', data)
      .then(() => {
        console.log(ok('[✔] Done!'));
        process.exit(0);
      })
      .catch(err => {
        console.log(error(`[✖] ${err}`));
        process.exit(1);
      });
  }

  console.log(notice('[ℹ] Nothing have been done... you do not look that sure...'));
}

module.exports = commandClearCache;
