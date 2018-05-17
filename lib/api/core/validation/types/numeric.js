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
  BaseType = require('../baseType'),
  allowedRangeOptions = ['min', 'max'];

/**
 * @class NumericType
 */
class NumericType extends BaseType {
  constructor() {
    super();
    this.typeName = 'numeric';
    this.allowChildren = false;
    this.allowedTypeOptions = ['range'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   */
  validate(typeOptions, fieldValue, errorMessages) {
    if (typeof fieldValue !== 'number') {
      errorMessages.push('The field must be a number.');
      return false;
    }

    if (typeOptions.hasOwnProperty('range')) {
      if (typeOptions.range.hasOwnProperty('min') && fieldValue < typeOptions.range.min) {
        errorMessages.push('The value is lesser than the minimum.');
        return false;
      }

      if (typeOptions.range.hasOwnProperty('max') && fieldValue > typeOptions.range.max) {
        errorMessages.push('The value is greater than the maximum.');
        return false;
      }
    }

    return true;
  }

  /**
   * @param {TypeOptions} typeOptions
   * @return {boolean|TypeOptions}
   * @throws InternalError
   */
  validateFieldSpecification(typeOptions) {
    if (typeOptions.hasOwnProperty('range') && !this.checkAllowedProperties(typeOptions.range, allowedRangeOptions)) {
      return false;
    }

    if (typeOptions.hasOwnProperty('range') && typeOptions.range.hasOwnProperty('min') && typeOptions.range.hasOwnProperty('max')) {
      return typeOptions.range.max >= typeOptions.range.min;
    }

    return true;
  }
}

module.exports = NumericType;
