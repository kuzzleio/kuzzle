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
  Bluebird = require('bluebird'),
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

function addWrite(stream, data) {
  return () => (
    new Promise(resolve => stream.write(data, () => resolve()))
  );
}

function dumpCollectionPart (results, ndjsonStream) {
  if (!results) {
    return Promise.resolve(null);
  }

  const promises = [];

  for (const hit of results.hits) {
    promises.push(addWrite(ndjsonStream, {
      _id: hit._id,
      body: hit._source
    }));
  }

  return Bluebird.each(promises, promise => promise())
    .then(() => results.next())
    .then(nextResults => dumpCollectionPart(nextResults, ndjsonStream));
}

function dumpCollection (sdk, index, collection, directoryPath) {
  const
    filename = `${directoryPath}/${index}--${collection}--dump.jsonl`,
    writeStream = fs.createWriteStream(filename),
    ndjsonStream = ndjson.serialize(),
    options = {
      scroll: '10m',
      size: 500
    };

  ndjsonStream.on('data', line => writeStream.write(line));

  const waitWrite = new Promise(resolve => ndjsonStream.on('finish', resolve));

  return sdk.document.search(index, collection, {}, options)
    .then(results => dumpCollectionPart(results, ndjsonStream))
    .then(() => {
      ndjsonStream.end();

      return waitWrite;
    });
}

function indexDump (sdk, cout, index, directoryPath) {
  console.log(cout.notice(`Dumping index ${index} in ${directoryPath} ...`));

  mkdirp(directoryPath);

  return sdk.collection.list(index)
    .then(({ collections }) => {
      const promises = collections.map(collection => {
        return () => (
          dumpCollection(sdk, index, collection.name, directoryPath)
            .then(() => console.log(cout.ok(`[✔] Collection ${index}:${collection.name} dumped`)))
        );
      });

      return Bluebird.each(promises, promise => promise());
    });
}

function commandIndexDump (index, directoryPath, options) {
  let
    opts = options;

  const cout = new ColorOutput(opts);

  return getSdk(options)
    .then(sdk => indexDump(sdk, cout, index, directoryPath))
    .then(() => {
      console.log(cout.ok(`\n[✔] Index ${index} successfully dumped`));
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = commandIndexDump;
