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
  path = require('path'),
  ndjson = require('ndjson'),
  getSdk = require('./getSdk');

//@TODO use 'recursive: true' with node.js 10
function mkdirp (fullPath) {
  const parts = fullPath.split(path.sep);

  if (parts.length > 1) {
    mkdirp(parts.slice(0, parts.length - 1).join('/'));
  }

  if (! fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath);
  }
}

function writeData(stream, data) {
  return new Promise(resolve => {
    if (! stream.write(data)) {
      stream.once('drain', resolve);
    }
    else {
      resolve();
    }
  });
}

async function dumpCollection (sdk, index, collection, batchSize, directoryPath) {
  const
    filename = `${directoryPath}/${index}--${collection}--data.jsonl`,
    writeStream = fs.createWriteStream(filename),
    waitWrite = new Promise(resolve => writeStream.on('finish', resolve)),
    ndjsonStream = ndjson.serialize(),
    options = {
      scroll: '10m',
      size: batchSize
    };

  writeStream.on('error', error => {
    throw error;
  });

  ndjsonStream.on('data', line => writeStream.write(line));

  await writeData(ndjsonStream, { index, collection });

  let results = await sdk.document.search(index, collection, {}, options);

  do {
    process.stdout.write(`  ${results.fetched}/${results.total} documents dumped`);
    process.stdout.write('\r');

    for (const hit of results.hits) {
      const document = {
        _id: hit._id,
        body: hit._source
      };

      if (!ndjsonStream.write(document)) {
        await new Promise(resolve => ndjsonStream.once('drain', resolve));
      }
    }
  } while (results = await results.next());

  ndjsonStream.end();
  writeStream.end();

  return waitWrite;
}

async function indexDump (sdk, cout, index, batchSize, directoryPath) {
  cout.notice(`Dumping index ${index} in ${directoryPath} ...`);

  mkdirp(directoryPath);

  const { collections } = await sdk.collection.list(index);

  for (const collection of collections) {
    await dumpCollection(sdk, index, collection.name, batchSize, directoryPath);
    cout.ok(`[✔] Collection ${index}:${collection.name} dumped`);
  }
}

async function commandIndexDump (index, directoryPath, options) {
  const
    batchSize = options.batchSize || 10000,
    opts = options,
    cout = new ColorOutput(opts);

  try {
    const sdk = await getSdk(options, 'websocket');
    await indexDump(sdk, cout, index, batchSize, directoryPath);

    cout.ok(`\n[✔] Index ${index} successfully dumped`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = commandIndexDump;
