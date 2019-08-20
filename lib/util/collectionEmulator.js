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

'use strict';

const
  INTERNAL_PREFIX = '%',
  USER_PREFIX = '&',
  NAME_SEPARATOR = '.';

/**
 * Get the name of an esIndex for an index + collection
 * By default, return the name of an 'user' index.
 * The 'internal' option can be set to return the name for an internal index
 *
 * @param {string} index
 * @param {string} collection
 * @param {object} options - internal (false)
 *
 * @returns {string} esIndex name (eg: '&nepali#liia')
 */
function getESIndex (index, collection, { internal=false } = {}) {
  const prefix = internal
    ? INTERNAL_PREFIX
    : USER_PREFIX;

  return `${prefix}${index}${NAME_SEPARATOR}${collection}`;
}

/**
 * Extract the index name from esIndex name
 *
 * @param {string} esIndex
 *
 * @returns {string} index name
 */
function extractIndex (esIndex) {
  return esIndex.slice(1).split(NAME_SEPARATOR)[0];
}

/**
 * Extract the collection name from esIndex name
 *
 * @param {string} esIndex
 *
 * @returns {string} collection name
 */
function extractCollection (esIndex) {
  return esIndex.split(NAME_SEPARATOR)[1];
}

/**
 * Returns a list of index names from esIndex names
 * By default, return the names of 'user' indexes.
 * The 'internal' option can be set to return the names of internal indexes
 *
 * @param {Array<string>} esIndexes
 * @param {object} options - internal (false)
 *
 * @returns {Array<string>} index names
 */
function extractIndexes (esIndexes, { internal=false } = {}) {
  const
    indexes = new Set(),
    prefix = internal
      ? INTERNAL_PREFIX
      : USER_PREFIX;

  for (const esIndex of esIndexes) {
    if (esIndex[0] === prefix) {
      indexes.add(extractIndex(esIndex));
    }
  }

  return Array.from(indexes);
}

/**
 * Returns a list of collection names for an index from esIndex names
 * By default, return the names of 'user' collections.
 * The 'internal' option can be set to return the names of internal collections
 *
 * @param {Array<string>} esIndexes
 * @param {object} options - internal (false)
 *
 * @returns {Array<string>} collection names
 */
function extractCollections (esIndexes, index, { internal=false } = {}) {
  const
    collections = new Set(),
    prefix = internal
      ? INTERNAL_PREFIX
      : USER_PREFIX;

  for (const esIndex of esIndexes) {
    const [indexName, collectionName] = esIndex.slice(1).split(NAME_SEPARATOR);

    if (esIndex[0] === prefix && indexName === index) {
      collections.add(collectionName);
    }
  }

  return Array.from(collections);
}

module.exports = {
  getESIndex,
  extractIndex,
  extractCollection,
  extractIndexes,
  extractCollections
};