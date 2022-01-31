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
  kerror = require('../../../kerror'),
  BaseType = require('../baseType');

/**
 * @class EnumType
 */
class EnumType extends BaseType {
  constructor () {
    super();
    this.typeName = 'enum';
    this.allowChildren = false;
    this.allowedTypeOptions = ['values'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  validate (typeOptions, fieldValue, errorMessages) {
    if (typeof fieldValue !== 'string') {
      errorMessages.push('The field must be a string.');
      return false;
    }

    if (! typeOptions.values.includes(fieldValue)) {
      errorMessages.push(
        `The field only accepts following values: "${typeOptions.values.join(', ')}".`);
      return false;
    }

    return true;
  }

  /**
   * @param {TypeOptions} typeOptions
   * @returns {TypeOptions}
   * @throws {PreconditionError}
   */
  validateFieldSpecification (typeOptions) {
    if (! Object.prototype.hasOwnProperty.call(typeOptions, 'values')) {
      throw kerror.get('validation', 'types', 'missing_enum_values');
    }

    if (! Array.isArray(typeOptions.values)
      || typeOptions.values.length === 0
    ) {
      throw kerror.get('validation', 'assert', 'invalid_type', 'values', 'string[]');
    }

    const nonString = typeOptions.values.filter(
      value => typeof value !== 'string');

    if (nonString.length > 0) {
      throw kerror.get('validation', 'assert', 'invalid_type', 'values', 'string[]');
    }

    return typeOptions;
  }
}

module.exports = EnumType;
