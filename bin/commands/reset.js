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
  fs = require('fs'),
  ColorOutput = require('./colorOutput');

function commandReset (options) {
  const
    kuzzle = new (require('../../lib/api/kuzzle'))(),
    cout = new ColorOutput(options);

  let
    userIsSure = false,
    fixturesContent,
    mappingsContent;

  // check, if files are provided, if they exists
  if (params.fixtures) {
    try {
      fixturesContent = JSON.parse(fs.readFileSync(params.fixtures, 'utf8'));
    }
    catch (e) {
      console.log(cout.error(`[✖] The file ${params.fixtures} cannot be opened. Abort.`));
      process.exit(1);
    }
  }

  if (params.mappings) {
    try {
      mappingsContent = JSON.parse(fs.readFileSync(params.mappings, 'utf8'));
    }
    catch (e) {
      console.log(cout.error(`[✖] The file ${params.mappings} cannot be opened. Abort.`));
      process.exit(1);
    }
  }

  console.log(cout.warn('[ℹ] You are about to reset Kuzzle configuration and users'));
  console.log(cout.warn('[ℹ] This operation cannot be undone.\n'));

  if (!params.noint) {
    userIsSure = readlineSync.question('[❓] Are you sure? If so, please type "I am sure": ') === 'I am sure';
  } else {
    // not intteractive mode
    userIsSure = true;
  }

  if (userIsSure) {
    console.log(cout.notice('[ℹ] Processing...\n'));
    return kuzzle.cli.doAction('cleanDb', {}, {debug: options.parent.debug})
      .then(() => {
        return kuzzle.cli.doAction('data', {
          body: {
            fixtures: fixturesContent,
            mappings: mappingsContent
          }
        }, {debug: options.parent.debug});
      })
      .then(() => {
        console.log(cout.ok('[✔] Kuzzle has been successfully reset'));
        process.exit(0);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  }

  console.log(cout.notice('[ℹ] Aborted'));
}

module.exports = commandReset;
