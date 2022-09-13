/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

"use strict";

const BaseType = require("../baseType");

/**
 * @class BooleanType
 */
class BooleanType extends BaseType {
  constructor() {
    super();
    this.typeName = "boolean";
    this.allowChildren = false;
    this.allowedTypeOptions = [];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {*} fieldValue
   * @param {string[]} errorMessages
   */
  validate(typeOptions, fieldValue, errorMessages) {
    if (typeof fieldValue !== "boolean") {
      errorMessages.push("The field must be of type boolean.");
      return false;
    }

    return true;
  }
}

module.exports = BooleanType;
