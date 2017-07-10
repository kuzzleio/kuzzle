/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

/**
 * Verifies that ALL "fields" are contained in object "obj".
 * These fields must be of type "type", and an optional regular
 * expression can be provided to check that fields are well-formed
 *
 * @param {object} obj - object containing the fields
 * @param {Array} fields - list of fields to test
 * @param {string} type - field type (typeof result)
 * @param {RegExp} [regex] - optional regex testing that a field is well-formed
 * @returns {Boolean}
 */
function fieldsExist(obj, fields, type, regex) {
  let i; // NOSONAR

  for(i = 0; i < fields.length; i++) {
    const value = fields[i];

    if (regex) {
      regex.lastIndex = 0;
    }
    
    if (obj[value] === undefined || typeof obj[value] !== type || (regex && !regex.test(obj[value]))) {
      return false;
    }
  }

  return true;
}

module.exports = fieldsExist;
