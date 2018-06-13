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

const Numeric = require('./numeric');

/**
 * @class IntegerType
 */
class IntegerType extends Numeric {
  constructor() {
    super();
    this.typeName = 'integer';
    this.allowChildren = false;
    this.allowedTypeOptions = ['range'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   * @return {boolean}
   */
  validate(typeOptions, fieldValue, errorMessages) {
    if (!super.validate(typeOptions, fieldValue, errorMessages)) {
      return false;
    }

    if (!Number.isInteger(fieldValue)) {
      errorMessages.push('The field must be an integer.');
      return false;
    }

    return true;
  }
}

module.exports = IntegerType;
