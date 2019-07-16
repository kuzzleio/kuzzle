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
  ndjson = require('ndjson'),
  getSdk = require('./getSdk');

function handleError(cout, dumpFile, error) {
  if (error.status === 206) {
    const
      errorFile = `${dumpFile.split('.').slice(0, -1).join('.')}-errors.jsonl`,
      writeStream = fs.createWriteStream(errorFile, { flags: 'a' }),
      serialize = ndjson.serialize().pipe(writeStream)

    serialize.on('data', line => {
      writeStream.write(line);
    });

    for (const partialError of error.errors) {
      serialize.write(partialError);
    }

    serialize.end();
    cout.warn(`[ℹ] Error importing ${dumpFile}. See errors in ${errorFile}`);
  } else {
    cout.warn(error.message);
  }
  process.exit(1);
}

function importCollection(sdk, cout, batchSize, dumpFile) {
  const mWriteRequest = {
    controller: 'bulk',
    action: 'mWrite',
    body: {}
  };

  return new Promise(resolve => {
    let
      total = 0,
      headerSkipped = false,
      documents = [];

    const readStream = fs.createReadStream(dumpFile)
      .pipe(ndjson.parse())
      .on('data', obj => {
        if (headerSkipped) {
          documents.push(obj);

          if (documents.length === batchSize) {
            mWriteRequest.body.documents = documents;
            documents = [];

            readStream.pause();

            sdk.query(mWriteRequest)
              .catch(error => {
                handleError(cout, dumpFile, error);
                readStream.resume();
              })
              .then(() => {
                total += mWriteRequest.body.documents.length;
                process.stdout.write(`  ${total} documents handled`);
                process.stdout.write('\r');

                readStream.resume();
              });
          }
        } else {
          headerSkipped = true;
          mWriteRequest.index = obj.index;
          mWriteRequest.collection = obj.collection;
        }
      })
      .on('end', () => {
        if (documents.length > 0) {
          mWriteRequest.body.documents = documents;

          sdk.query(mWriteRequest)
            .catch(error => handleError(cout, dumpFile, error))
            .then(() => {
              total += mWriteRequest.body.documents.length;
              process.stdout.write(`  ${total} documents handled`);
              process.stdout.write('\r');

              resolve()
            });
        } else {
          resolve();
        }
      });
  });
}

async function indexRestore (dumpDirectory, options) {
  let
    opts = options;

  const
    batchSize = options.batchSize || 200,
    cout = new ColorOutput(opts);

  const sdk = await getSdk(options, 'websocket')

  cout.ok(`[✔] Start importing dump from ${dumpDirectory}`);

  const dumpFiles = fs.readdirSync(dumpDirectory).map(f => `${dumpDirectory}/${f}`);

  try {
    for (const dumpFile of dumpFiles) {
      await importCollection(sdk, cout, batchSize, dumpFile);

      cout.ok(`[✔] Dump file ${dumpFile} imported`);
    }

    process.exit(0);
  } catch (error) {
    cout.warn(`[ℹ] Error importing ${dumpFile}: ${error.message}`);

    process.exit(1);
  }
}

module.exports = indexRestore;
