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

const
  errorsManager = require('../../../../config/error-codes/throw'),
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

    if ( Object.prototype.hasOwnProperty.call(typeOptions.length, 'min')
      && fieldValue.length < typeOptions.length.min
    ) {
      errorMessages.push(`Invalid string length. Expected min: ${typeOptions.length.min}. Received: ${fieldValue.length} ("${fieldValue}")`);
      return false;
    }

    if ( Object.prototype.hasOwnProperty.call(typeOptions.length, 'max')
      && fieldValue.length > typeOptions.length.max
    ) {
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
    if (Object.prototype.hasOwnProperty.call(typeOptions, 'length')) {
      if (!this.checkAllowedProperties(typeOptions.length, ['min', 'max'])) {
        errorsManager.throw('internal', 'validation', 'invalid_length_option');
      }

      for (const prop of ['min', 'max']) {
        if ( Object.prototype.hasOwnProperty.call(typeOptions.length, prop)
          && typeof typeOptions.length[prop] !== 'number'
        ) {
          errorsManager.throw(
            'internal',
            'validation',
            'invalid_length_type',
            prop
          );
        }
      }

      if ( Object.prototype.hasOwnProperty.call(typeOptions.length, 'min')
        && Object.prototype.hasOwnProperty.call(typeOptions.length, 'max')
        && typeOptions.length.min > typeOptions.length.max
      ) {
        errorsManager.throw('internal', 'validation', 'invalid_length_range');
      }
    }

    return typeOptions;
  }
}

module.exports = StringType;
