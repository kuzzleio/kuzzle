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
  ColorOutput = require('./colorOutput');

function commandClearCache (database, options) {
  let
    opts = options,
    db = database,
    userIsSure;

  if (options === undefined) {
    opts = database;
    db = null;
  }

  const cout = new ColorOutput(opts);
  const data = {database: db};

  if (db === 'memoryStorage') {
    console.log(cout.warn('[ℹ] You are about to clear Kuzzle memoryStorage database.'));
    console.log(cout.warn('[ℹ] This operation cannot be undone.\n'));
    userIsSure = params.noint || readlineSync.question('[❓] Are you sure? If so, please type "I am sure" (if not just press [Enter]): ') === 'I am sure';
  } else {
    userIsSure = readlineSync.keyInYN(cout.question('[❓] Do you want to clear Kuzzle internal cache?'));
  }

  if (userIsSure) {
    const kuzzle = new (require('../../lib/api/kuzzle'))();

    console.log(cout.notice('[ℹ] Processing...\n'));
    return kuzzle.cli.doAction('clearCache', data)
      .then(() => {
        console.log(cout.ok('[✔] Done!'));
        process.exit(0);
      })
      .catch(err => {
        console.log(cout.error(`[✖] ${err}`));
        process.exit(1);
      });
  }

  console.log(cout.notice('[ℹ] Nothing have been done... you do not look that sure...'));
}

module.exports = commandClearCache;
