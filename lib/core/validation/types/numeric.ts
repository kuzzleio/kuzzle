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
import { NumericTypeOptions } from "../typeOptions";

const kerror = wrap("validation", "assert");

class NumericType extends BaseType<NumericTypeOptions> {
  public typeName = "numeric";
  public allowChildren = false;
  public allowedTypeOptions = ["range"];

  validate(
    typeOptions: NumericTypeOptions,
    fieldValue: unknown,
    errorMessages: string[],
  ): boolean {
    if (typeof fieldValue !== "number") {
      errorMessages.push("The field must be a number.");
      return false;
    }

    const { range } = typeOptions;

    if (range) {
      if (range.min !== undefined && fieldValue < range.min) {
        errorMessages.push(
          `Value ${fieldValue} is lesser than the allowed minimum (${range.min})`,
        );
        return false;
      }

      if (range.max !== undefined && fieldValue > range.max) {
        errorMessages.push(
          `Value ${fieldValue} is greater than the allowed maximum (${range.max})`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * @throws {PreconditionError}
   */
  validateFieldSpecification(
    typeOptions: NumericTypeOptions,
  ): NumericTypeOptions {
    if (has(typeOptions, "range")) {
      const { range } = typeOptions;

      if (!this.checkAllowedProperties(range, ["min", "max"])) {
        throw kerror.get("unexpected_properties", "range", "min, max");
      }

      for (const prop of ["min", "max"] as const) {
        if (has(range, prop) && typeof range[prop] !== "number") {
          throw kerror.get("invalid_type", `range.${prop}`, "number");
        }
      }

      const { min, max } = range;

      if (min !== undefined && max !== undefined && max < min) {
        throw kerror.get("invalid_range", "range", "min", "max");
      }
    }

    return typeOptions;
  }
}

export = NumericType;
