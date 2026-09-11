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

import { wrap } from "../../../kerror";
import { has } from "../../../util/safeObject";
import BaseType from "../baseType";
import { StringTypeOptions } from "../typeOptions";

const kerror = wrap("validation", "assert");

class StringType extends BaseType<StringTypeOptions> {
  public typeName = "string";
  public allowChildren = false;
  public allowedTypeOptions = ["length"];

  validate(
    typeOptions: StringTypeOptions,
    fieldValue: unknown,
    errorMessages: string[],
  ): boolean {
    if (typeof fieldValue !== "string") {
      errorMessages.push("The field must be a string.");
      return false;
    }

    const { length } = typeOptions;

    if (!length) {
      return true;
    }

    if (length.min !== undefined && fieldValue.length < length.min) {
      errorMessages.push(
        `Invalid string length. Expected min: ${length.min}. Received: ${fieldValue.length} ("${fieldValue}")`,
      );
      return false;
    }

    if (length.max !== undefined && fieldValue.length > length.max) {
      errorMessages.push(
        `Invalid string length. Expected max: ${length.max}. Received: ${fieldValue.length} ("${fieldValue}")`,
      );
      return false;
    }

    return true;
  }

  /**
   * @throws {PreconditionError}
   */
  validateFieldSpecification(
    typeOptions: StringTypeOptions,
  ): StringTypeOptions {
    if (has(typeOptions, "length")) {
      const { length } = typeOptions;

      if (!this.checkAllowedProperties(length, ["min", "max"])) {
        throw kerror.get("unexpected_properties", "length", "min, max");
      }

      for (const prop of ["min", "max"] as const) {
        if (has(length, prop) && typeof length[prop] !== "number") {
          throw kerror.get("invalid_type", `length.${prop}`, "number");
        }
      }

      const { min, max } = length;

      if (min !== undefined && max !== undefined && min > max) {
        throw kerror.get("invalid_range", "length", "min", "max");
      }
    }

    return typeOptions;
  }
}

export = StringType;
