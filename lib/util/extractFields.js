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

'use strict';

const { isPlainObject } = require('./safeObject');

/**
* Extract nested fields of an object in a flat array.
* Example: { field : { 1: "nested", 2: "nested" } } => [ 'field.1', 'field.2' ]
*
* @param {Object} document - Document to extract fields from
* @param {Object} options - alsoExtractValues (false), fieldsToIgnore ( [ ] )
*
* @returns { Array<String> | Array<{ key: String, value: any }> }
*/
function extractFields(document, {
  fieldsToIgnore = [],
  alsoExtractValues = false,
} = {}, {
  path = null,
  extractedFields = []
} = {}) {
  for (const [key, value] of Object.entries(document)) {
    if ( fieldsToIgnore.length
      && fieldsToIgnore.find(keyToIgnore => keyToIgnore === key )
    ) {
      continue;
    }

    const currentPath = path ? `${path}.${key}` : key;

    if (isPlainObject(value)) {
      extractFields(value,
        { alsoExtractValues, fieldsToIgnore },
        { extractedFields, path: currentPath });
    }
    else if (alsoExtractValues) {
      extractedFields.push({key: currentPath, value});
    }
    else {
      extractedFields.push(currentPath);
    }
  }

  return extractedFields;
}

module.exports = extractFields;
