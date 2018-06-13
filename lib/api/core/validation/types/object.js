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
 * @class ObjectType
 */
class ObjectType extends BaseType {
  constructor() {
    super();
    this.typeName = 'object';
    this.allowChildren = true;
    this.allowedTypeOptions = ['strict'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  validate(typeOptions, fieldValue, errorMessages) {
    if (fieldValue === null || typeof fieldValue !== 'object' || Array.isArray(fieldValue)) {
      errorMessages.push('The value must be an object.');
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
    if (typeOptions.hasOwnProperty('strict') && typeof typeOptions.strict !== 'boolean') {
      throw new PreconditionError('Option "strict" must be of type "boolean"');
    }

    return typeOptions;
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {boolean} parentStrictness
   * @return {boolean|TypeOptions}
   * @throws InternalError
   */
  getStrictness(typeOptions, parentStrictness) {
    if (!typeOptions.hasOwnProperty('strict')) {
      return parentStrictness;
    }

    return typeOptions.strict;
  }
}

module.exports = ObjectType;

