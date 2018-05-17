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

/* eslint-disable no-console */

const
  fs = require('fs'),
  rc = require('rc'),
  params = rc('kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  {
    PartialError
  } = require('kuzzle-common-objects').errors,
  ColorOutput = require('./colorOutput');

function commandStart (options) {
  const
    kuzzle = new (require('../../lib/api/kuzzle'))(),
    cout = new ColorOutput(options);

  console.log(cout.kuz('[ℹ] Starting Kuzzle server'));

  kuzzle.start(params)
    // fixtures && mapping
    .then(() => {
      const requests = [];

      if (params.mappings) {
        let mappings;

        try {
          mappings = JSON.parse(fs.readFileSync(params.mappings, 'utf8'));
        }
        catch (e) {
          console.log(cout.error(`[✖] The file ${params.mappings} cannot be parsed. Abort.`));
          process.exit(1);
        }

        console.log(cout.notice(`[ℹ] Loading mappings from ${params.mappings} into storage layer`));

        for (const index of Object.keys(mappings)) {
          for (const collection of Object.keys(mappings[index])) {
            requests.push(new Request({
              index,
              collection,
              body: mappings[index][collection]
            }));
          }
        }
      }

      return requests;
    })
    .each(rq => {
      const 
        index = rq.input.resource.index,
        indexRequest = new Request({index});

      return kuzzle.services.list.storageEngine.indexExists(indexRequest)
        .then(exist => {
          if (!exist) {
            console.log(cout.notice(`[ℹ] Creating index: ${index}`));
            return kuzzle.services.list.storageEngine.createIndex(indexRequest);
          }
        })
        .then(() => kuzzle.services.list.storageEngine.updateMapping(rq))
        .then(() => kuzzle.services.list.storageEngine.refreshIndex(indexRequest))
        .then(() => {
          const collection = rq.input.resource.collection;

          kuzzle.indexCache.add(index, collection);
          console.log(cout.ok(`[✔] Mappings for ${index}/${collection} successfully applied`));

          return null;
        });
    })
    .then(() => {
      const requests = [];

      if (params.fixtures) {
        let fixtures;

        try {
          fixtures = JSON.parse(fs.readFileSync(params.fixtures, 'utf8'));
        }
        catch (e) {
          console.log(cout.error(`[✖] The file ${params.fixtures} cannot be parsed. Abort.`));
          process.exit(1);
        }

        console.log(cout.notice(`[ℹ] Loading fixtures from ${params.fixtures} into storage layer`));

        for (const index of Object.keys(fixtures)) {
          for (const collection of Object.keys(fixtures[index])) {
            requests.push(new Request({
              index,
              collection,
              body: {
                bulkData: fixtures[index][collection]
              }
            }));
          }
        }
      }

      return requests;
    })
    .each(rq => {
      return kuzzle.services.list.storageEngine.import(rq)
        .then(res => {
          if (res.partialErrors && res.partialErrors.length > 0) {
            // use native console to allow default output trimming in case of big fixtures
            console.error(res.partialErrors);
            throw new PartialError(`Some data was not imported for ${rq.input.resource.index}/${rq.input.resource.collection} (${res.partialErrors.length}/${res.items.length + res.partialErrors.length}).`, res.partialErrors);
          }
          return res;
        })
        .then(res => {
          return kuzzle.services.list.storageEngine.refreshIndex(new Request({index: rq.input.resource.index}))
            .then(() => console.log(cout.ok(`[✔] Fixtures for ${rq.input.resource.index}/${rq.input.resource.collection} successfully loaded: ${res.items.length} documents created`)));
        });
    })
    .then(() => {
      console.log(cout.kuz('[✔] Kuzzle server ready'));
      return kuzzle.internalEngine.bootstrap.adminExists()
        .then(res => {
          if (!res) {
            console.log(cout.warn('[!] [WARNING] There is no administrator user yet: everyone has administrator rights.'));
            console.log(cout.notice('[ℹ] You can use the CLI or the back-office to create the first administrator user.'));
            console.log(cout.notice('    For more information: http://docs.kuzzle.io/guide/essentials/security'));
          }
        });
    })
    .catch(err => {
      console.error(cout.error(`[x] [ERROR] ${err.stack}`));
      process.exit(1);
    });
}

module.exports = commandStart;
