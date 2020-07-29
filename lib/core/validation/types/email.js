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
   * @returns {boolean}
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
   * @returns {TypeOptions}
   * @throws {PreconditionError}
   */
  validateFieldSpecification(typeOptions) {
    if (!Object.prototype.hasOwnProperty.call(typeOptions, 'notEmpty')) {
      typeOptions.notEmpty = false;
    }
    else if (typeof typeOptions.notEmpty !== 'boolean') {
      throw kerror.get('invalid_type', 'notEmpty', 'boolean');
    }


    return typeOptions;
  }
}

module.exports = EmailType;
