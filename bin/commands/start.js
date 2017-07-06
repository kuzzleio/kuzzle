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
  fs = require('fs'),
  rc = require('rc'),
  params = rc('kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  Bluebird = require('bluebird'),
  clc = require('cli-color');

function commandStart (options) {
  const
    kuzzle = new (require('../../lib/api/kuzzle'))(),
    error = string => options.parent.noColors ? string : clc.red(string),
    warn = string => options.parent.noColors ? string : clc.yellow(string),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    kuz = string => options.parent.noColors ? string : clc.greenBright.bold(string);

  console.log(kuz('[ℹ] Starting Kuzzle server'));

  kuzzle.start(params)
    // fixtures && mapping
    .then(() => {
      if (params.fixtures) {
        let fixtures;
        const promises = [];

        try {
          fixtures = JSON.parse(fs.readFileSync(params.fixtures, 'utf8'));
        }
        catch (e) {
          console.log(error(`[✖] The file ${params.fixtures} cannot be opened. Abort.`));
          process.exit(1);
        }

        Object.keys(fixtures).forEach(index => {
          Object.keys(fixtures[index]).forEach(collection => {
            promises.push(kuzzle.services.list.storageEngine.import(new Request({
              index,
              collection,
              body: {
                bulkData: fixtures[index][collection]
              }
            })));
          });
        });

        return Bluebird.all(promises);
      }
    })
    .then(() => {
      if (params.mappings) {
        let mappings;
        const promises = [];

        try {
          mappings = JSON.parse(fs.readFileSync(params.mappings, 'utf8'));
        }
        catch (e) {
          console.log(error(`[✖] The file ${params.mappings} cannot be opened. Abort.`));
          process.exit(1);
        }

        Object.keys(mappings).forEach(index => {
          Object.keys(mappings[index]).forEach(collection => {
            promises.push(kuzzle.services.list.storageEngine.updateMapping(new Request({
              index,
              collection,
              body: mappings[index][collection]
            })));
          });
        });

        return Bluebird.all(promises);
      }
    })
    .then(() => {
      console.log(kuz('[✔] Kuzzle server ready'));
      return kuzzle.internalEngine.bootstrap.adminExists()
        .then(res => {
          if (!res) {
            console.log(warn('[!] [WARNING] There is no administrator user yet: everyone has administrator rights.'));
            console.log(notice('[ℹ] You can use the CLI or the back-office to create the first administrator user.'));
            console.log(notice('    For more information: http://docs.kuzzle.io/guide/essentials/security'));
          }
        });
    })
    .catch(err => {
      console.error(error(`[x] [ERROR] ${err.stack}`));
      process.exit(1);
    });
}

module.exports = commandStart;
