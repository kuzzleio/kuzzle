/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

/*
  Set of utility functions meant to ease up the use of Koncorde v4 in Kuzzle
 */

import { uniq } from 'lodash';
import { JSONObject } from 'kuzzle-sdk';
import { Koncorde } from 'koncorde';

// No collision possible: "/" is forbidden in index (or collection) names
const SEPARATOR = '/';

/**
 * Builds a Koncorde v4 index name from the old fashioned index+collection
 * arguments
 *
 * @param {string} index
 * @param {string} collection
 * @return {string}
 */
export function toKoncordeIndex (index: string, collection: string) : string {
  return `${index}${SEPARATOR}${collection}`;
}

/**
 * Returns an index+collection pair from a Koncorde v4 index name
 *
 * @param {string} index - Koncorde v4 index name
 * @return {{index: string, collection: string}}
 */
export function fromKoncordeIndex (index: string)
  : { collection: string, index: string }
{
  const [ kindex, kcollection ] = index.split(SEPARATOR);

  return {
    collection: kcollection,
    index: kindex,
  };
}

/**
 * Quick compat method to start a Koncorde test
 *
 * @param {Koncorde} koncorde instance
 * @param {string} index
 * @param {string} collection
 * @param {JSONObject} body
 * @param {string} [_id]
 */
export function koncordeTest (
  koncorde: Koncorde,
  index: string,
  collection: string,
  body: JSONObject,
  _id?: string
) : string[] {
  const indexV4 = toKoncordeIndex(index, collection);

  // Koncorde v4 silently accepts the old "ids" keyword, but it is now
  // an undocumented feature, left there so that Kuzzle can use Koncorde v4
  // without breaking changes. But Kuzzle now have to inject the "_id" field
  // necessary for that "ids" keyword.
  const data = _id ? Object.assign({}, body, { _id }) : body;

  return koncorde.test(data, indexV4);
}

/**
 * Extracts the list of Koncorde indexes and translate them into a
 * Kuzzle collections list
 *
 * @param  {Koncorde} koncorde
 * @param  {string}   index - Kuzzle index name
 * @return {string[]}
 */
export function getCollections (koncorde: Koncorde, index: string): string[] {
  const indexPrefix = `${index}${SEPARATOR}`;

  return koncorde
    .getIndexes()
    .filter(i => i.startsWith(indexPrefix))
    .map(i => i.substr(indexPrefix.length));
}

/**
 * Extracts the list of Koncorde indexes and translate them into a
 * Kuzzle indexes list
 *
 * @param  {Koncorde} koncorde
 * @return {string[]}
 */
export function getIndexes (koncorde: Koncorde): string[] {
  const indexes = koncorde
    .getIndexes()
    .filter(i => i !== '(default)')
    .map(i => i.substr(0, i.indexOf(SEPARATOR)));

  return uniq(indexes);
}
