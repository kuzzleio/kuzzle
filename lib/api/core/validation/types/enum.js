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
 * @class EnumType
 */
class EnumType extends BaseType {
  constructor() {
    super();
    this.typeName = 'enum';
    this.allowChildren = false;
    this.allowedTypeOptions = ['values'];
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

    if (typeOptions.values.indexOf(fieldValue) === -1) {
      errorMessages.push(`The field only accepts following values: "${typeOptions.values.join(', ')}".`);
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
    if (!typeOptions.hasOwnProperty('values')) {
      throw new PreconditionError('Option "values" is required');
    }

    if (!Array.isArray(typeOptions.values) || typeOptions.values.length === 0) {
      throw new PreconditionError('Option "values" must be a non-empty array');
    }

    const nonString = typeOptions.values.filter(value => typeof value !== 'string');

    if (nonString.length > 0) {
      throw new PreconditionError(`Values must be of type "string". Invalid value${nonString.length > 1 ? 's' : ''}: ${nonString}`);
    }

    return typeOptions;
  }
}

module.exports = EnumType;
