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

const
  PreconditionError = require('kuzzle-common-objects').errors.PreconditionError,
  BaseType = require('../baseType');

/**
 * @class StringType
 */
class StringType extends BaseType {
  constructor() {
    super();
    this.typeName = 'string';
    this.allowChildren = false;
    this.allowedTypeOptions = ['length'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @return {boolean}
   */
  validate(typeOptions, fieldValue, errorMessages) {
    if (typeof fieldValue !== 'string') {
      errorMessages.push('The field must be a string.');
      return false;
    }

    if (!typeOptions.length) {
      return true;
    }

    if (typeOptions.length.hasOwnProperty('min') && fieldValue.length < typeOptions.length.min) {
      errorMessages.push(`Invalid string length. Expected min: ${typeOptions.length.min}. Received: ${fieldValue.length} ("${fieldValue}")`);
      return false;
    }

    if (typeOptions.length.hasOwnProperty('max') && fieldValue.length > typeOptions.length.max) {
      errorMessages.push(`Invalid string length. Expected max: ${typeOptions.length.max}. Received: ${fieldValue.length} ("${fieldValue}")`);
      return false;
    }

    return true;
  }

  /**
   * @param {TypeOptions} typeOptions
   * @return {TypeOptions}
   * @throws {PreconditionError}
   */
  validateFieldSpecification(typeOptions) {
    if (typeOptions.hasOwnProperty('length')) {
      if (!this.checkAllowedProperties(typeOptions.length, ['min', 'max'])) {
        throw new PreconditionError('Invalid "length" option definition');
      }

      for (const prop of ['min', 'max']) {
        if (typeOptions.length.hasOwnProperty(prop) && typeof typeOptions.length[prop] !== 'number') {
          throw new PreconditionError(`Invalid "length.${prop}" option: must be of type "number"`);
        }
      }

      if (typeOptions.length.hasOwnProperty('min') && typeOptions.length.hasOwnProperty('max') && typeOptions.length.min > typeOptions.length.max) {
        throw new PreconditionError('Invalid length range: min > max');
      }
    }

    return typeOptions;
  }
}

module.exports = StringType;
