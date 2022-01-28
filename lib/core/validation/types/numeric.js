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

const
  kerror = require('../../../kerror').wrap('validation', 'assert'),
  BaseType = require('../baseType');

/**
 * @class NumericType
 */
class NumericType extends BaseType {
  constructor () {
    super();
    this.typeName = 'numeric';
    this.allowChildren = false;
    this.allowedTypeOptions = ['range'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  validate (typeOptions, fieldValue, errorMessages) {
    if (typeof fieldValue !== 'number') {
      errorMessages.push('The field must be a number.');
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(typeOptions, 'range')) {
      if (Object.prototype.hasOwnProperty.call(typeOptions.range, 'min')
        && fieldValue < typeOptions.range.min
      ) {
        errorMessages.push(`Value ${fieldValue} is lesser than the allowed minimum (${typeOptions.range.min})`);
        return false;
      }

      if (Object.prototype.hasOwnProperty.call(typeOptions.range, 'max')
        && fieldValue > typeOptions.range.max
      ) {
        errorMessages.push(`Value ${fieldValue} is greater than the allowed maximum (${typeOptions.range.max})`);
        return false;
      }
    }

    return true;
  }

  /**
   * @param {TypeOptions} typeOptions
   * @returns {TypeOptions}
   * @throws {PreconditionError}
   */
  validateFieldSpecification (typeOptions) {
    if (Object.prototype.hasOwnProperty.call(typeOptions, 'range')) {
      if (!this.checkAllowedProperties(typeOptions.range, ['min', 'max'])) {
        throw kerror.get('unexpected_properties', 'range', 'min, max');
      }

      for (const prop of ['min', 'max']) {
        if (Object.prototype.hasOwnProperty.call(typeOptions.range, prop)
          && typeof typeOptions.range[prop] !== 'number'
        ) {
          throw kerror.get('invalid_type', `range.${prop}`, 'number');
        }
      }

      if ( Object.prototype.hasOwnProperty.call(typeOptions.range, 'min')
        && Object.prototype.hasOwnProperty.call(typeOptions.range, 'max')
        && typeOptions.range.max < typeOptions.range.min
      ) {
        throw kerror.get('invalid_range', 'range', 'min', 'max');
      }
    }

    return typeOptions;
  }
}

module.exports = NumericType;
