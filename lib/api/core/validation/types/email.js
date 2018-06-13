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
  BaseType = require('../baseType'),
  validator = require('validator');

/**
 * @class EmailType
 */
class EmailType extends BaseType {
  constructor() {
    super();
    this.typeName = 'email';
    this.allowChildren = false;
    this.allowedTypeOptions = ['notEmpty'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @return {boolean}
   */
  validate(typeOptions, fieldValue, errorMessages) {
    if (fieldValue === undefined || fieldValue === null) {
      if (typeOptions.notEmpty) {
        errorMessages.push('Field cannot be undefined or null');
        return false;
      }

      return true;
    }

    if (typeof fieldValue !== 'string') {
      errorMessages.push('The field must be a string.');
      return false;
    }

    if (fieldValue.length === 0) {
      if (typeOptions.notEmpty === true) {
        errorMessages.push('The string must not be empty.');
        return false;
      }
      return true;
    }

    if (!validator.isEmail(fieldValue)) {
      errorMessages.push('The string must be a valid email address.');
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
    if (typeOptions.hasOwnProperty('notEmpty') && typeof typeOptions.notEmpty !== 'boolean') {
      throw new PreconditionError('Option "notEmpty" must be of type "boolean"');
    }

    if (!typeOptions.hasOwnProperty('notEmpty')) {
      typeOptions.notEmpty = false;
    }

    return typeOptions;
  }
}

module.exports = EmailType;
