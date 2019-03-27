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
  getSdk = require('./getSdk');

function mkdirp (fullPath) {
  const parts = fullPath.split(path.sep);

  if (parts.length > 1) {
    mkdirp(parts.slice(0, parts.length - 1).join('/'));
  }

  if (! fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath);
  }
}

function dumpCollectionPart (results, bulkDocuments) {
  if (!results) {
    return null;
  }

  for (const hit of results.hits) {
    bulkDocuments.push({
      create: {
        _id: hit._id,
        _index: hit._index,
        _type: hit._type
      }
    });

    delete hit._source._kuzzle_info;
    bulkDocuments.push(hit._source);
  }

  return results.next()
    .then(nextResults => dumpCollectionPart(nextResults, bulkDocuments));
}

function dumpCollection (sdk, index, collection, directoryPath) {
  const
    filename = `${directoryPath}/${index}-${collection}-dump.json`,
    options = {
      scroll: '10m',
      size: 500
    },
    bulkDocuments = [];


  return sdk.document.search(index, collection, {}, options)
    .then(results => dumpCollectionPart(results, bulkDocuments))
    .then(() => {
      return new Promise((resolve, reject) => {
        fs.writeFile(filename, JSON.stringify(bulkDocuments, null, 2), error => {
          if (error) {
            return reject(error);
          }

          resolve();
        });
      });
    });
}

function dumpIndex (sdk, cout, index, directoryPath) {
  console.log(cout.notice(`Dumping index ${index} in ${directoryPath} ...`));

  mkdirp(directoryPath);

  return sdk.collection.list(index)
    .then(({ collections }) => {
      return Promise.all(collections.map(collection => {
        return dumpCollection(sdk, index, collection.name, directoryPath)
          .then(() => console.log(cout.ok(`[✔] Collection ${index}:${collection.name} dumped`)));
      }));
    });
}

function commandDumpIndex (index, directoryPath, options) {
  let
    opts = options;

  const cout = new ColorOutput(opts);

  return getSdk(options)
    .then(sdk => dumpIndex(sdk, cout, index, directoryPath))
    .then(() => {
      console.log(cout.ok(`\n[✔] Index ${index} successfully dumped`));
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = commandDumpIndex;
