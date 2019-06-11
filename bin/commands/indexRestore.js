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
  ColorOutput = require('./colorOutput'),
  getSdk = require('./getSdk');

function importCollection (sdk, cout, dumpFiles) {
  if (dumpFiles.length === 0) {
    return null;
  }

  const bulkData = JSON.parse(fs.readFileSync(dumpFiles[0]));

  if (bulkData.length === 0) {
    console.log(cout.notice(`[ℹ] File ${dumpFiles[0]} is empty. Skip import.`));

    return importCollection(sdk, cout, dumpFiles.slice(1));
  }

  return sdk.bulk.import(bulkData)
    .then(() => {
      console.log(cout.ok(`[✔] Dump file ${dumpFiles[0]} imported`));

      return null;
    })
    .catch(error => {
      console.log(cout.warn(`[ℹ] Error importing ${dumpFiles[0]}`));
      if (error.status === 206) {
        for (const err of error.errors) {
          console.log(`  ${err.error.reason}`);
        }
      } else {
        console.log(error.message);
      }
      return null;
    })
    .then(() => importCollection(sdk, cout, dumpFiles.slice(1)));
}

function indexRestore (dumpDirectory, options) {
  let
    opts = options;

  const cout = new ColorOutput(opts);

  return getSdk(options)
    .then(sdk => {
      console.log(cout.ok(`[✔] Start importing dump from ${dumpDirectory}`));
      const dumpFiles = fs.readdirSync(dumpDirectory).map(f => `${dumpDirectory}/${f}`);

      return importCollection(sdk, cout, dumpFiles);
    })
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = indexRestore;
