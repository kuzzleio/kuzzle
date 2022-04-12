/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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
 * @class BaseType
 */
class BaseType {
  /**
   * Validate a document against a registered field type validator
   *
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  validate () {
    return true;
  }

  /**
   * Validate a field specification itself
   *
   * @param {TypeOptions} typeOptions
   * @returns {TypeOptions}
   * @throws {KuzzleError}
   */
  validateFieldSpecification (opts) {
    return opts;
  }

  /**
   * @param {*} object
   * @param {string[]} allowedProperties
   * @returns {boolean}
   */
  checkAllowedProperties (object, allowedProperties) {
    if (typeof object !== 'object'
      || Array.isArray(object)
      || object === null
    ) {
      return false;
    }

    return ! Object.keys(object).some(
      propertyName => allowedProperties.indexOf(propertyName) === -1);
  }

  /**
   * @param {StructuredFieldSpecification} fieldSpec
   * @param {boolean} parentStrictness
   * @returns {boolean}
   */
  getStrictness (fieldSpec, parentStrictness) {
    return parentStrictness;
  }
}

module.exports = BaseType;
