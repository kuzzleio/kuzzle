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
  StreamArray = require('stream-json/streamers/StreamArray'),
  { Writable } = require('stream');
  getSdk = require('./getSdk');

  // https://stackoverflow.com/questions/42896447/parse-large-json-file-in-nodejs-and-handle-each-object-independently/42897498
function importCollection (sdk, cout, dumpFiles) {
  console.log("1")
  if (dumpFiles.length === 0) {
    return Promise.resolve(null);
  }

  const
    fileStream = fs.createReadStream(dumpFiles[0]),
    jsonStream = StreamArray.withParser(),
    processingStream = new Writable({
      write({ bulkData }, encoding, next) {
        console.log(bulkData);
        next();
      },
      objectMode: true
    });

  fileStream.pipe(jsonStream.input);
  jsonStream.pipe(processingStream);
  processingStream.on('finish', () => console.log('All done'));

  const doImport = bulkData => {
    return sdk.bulk.import(bulkData)
    .then(() => {
      console.log(cout.ok(`[✔] Dump file ${dumpFiles[0]} imported`));

      return null;
    })
    .catch(error => {
      console.log(cout.warn(`[ℹ] Error importing ${dumpFiles[0]}. See errors in 'index-restore-errors.json'`));
      if (error.status === 206) {
        fs.writeFileSync('./index-restore-errors.json', JSON.stringify(error.errors, null, 2));
      } else {
        console.log(error.message);
      }
      return null;
    })
    .then(() => importCollection(sdk, cout, dumpFiles.slice(1)));
  };
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
