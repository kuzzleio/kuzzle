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

import isEmail from "validator/lib/isEmail";

import { wrap } from "../../../kerror";
import { has } from "../../../util/safeObject";
import BaseType from "../baseType";
import { NotEmptyTypeOptions } from "../typeOptions";

const kerror = wrap("validation", "assert");

class EmailType extends BaseType<NotEmptyTypeOptions> {
  public typeName = "email";
  public allowChildren = false;
  public allowedTypeOptions = ["notEmpty"];

  validate(
    typeOptions: NotEmptyTypeOptions,
    fieldValue: unknown,
    errorMessages: string[],
  ): boolean {
    if (fieldValue === undefined || fieldValue === null) {
      if (typeOptions.notEmpty) {
        errorMessages.push("Field cannot be undefined or null");
        return false;
      }

      return true;
    }

    if (typeof fieldValue !== "string") {
      errorMessages.push("The field must be a string.");
      return false;
    }

    if (fieldValue.length === 0) {
      if (typeOptions.notEmpty === true) {
        errorMessages.push("The string must not be empty.");
        return false;
      }
      return true;
    }

    if (!isEmail(fieldValue)) {
      errorMessages.push("The string must be a valid email address.");
      return false;
    }

    return true;
  }

  /**
   * @throws {PreconditionError}
   */
  validateFieldSpecification(
    typeOptions: NotEmptyTypeOptions,
  ): NotEmptyTypeOptions {
    if (!has(typeOptions, "notEmpty")) {
      typeOptions.notEmpty = false;
    } else if (typeof typeOptions.notEmpty !== "boolean") {
      throw kerror.get("invalid_type", "notEmpty", "boolean");
    }

    return typeOptions;
  }
}

export = EmailType;
