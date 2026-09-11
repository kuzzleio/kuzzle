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

import * as kerror from "../../../kerror";
import BaseType from "../baseType";
import { EnumTypeOptions } from "../typeOptions";

class EnumType extends BaseType<EnumTypeOptions> {
  public typeName = "enum";
  public allowChildren = false;
  public allowedTypeOptions = ["values"];

  validate(
    typeOptions: EnumTypeOptions,
    fieldValue: unknown,
    errorMessages: string[],
  ): boolean {
    if (typeof fieldValue !== "string") {
      errorMessages.push("The field must be a string.");
      return false;
    }

    const values = typeOptions.values ?? [];

    if (!values.includes(fieldValue)) {
      errorMessages.push(
        `The field only accepts following values: "${values.join(", ")}".`,
      );
      return false;
    }

    return true;
  }

  /**
   * @throws {PreconditionError}
   */
  validateFieldSpecification(typeOptions: EnumTypeOptions): EnumTypeOptions {
    if (!Object.prototype.hasOwnProperty.call(typeOptions, "values")) {
      throw kerror.get("validation", "types", "missing_enum_values");
    }

    const { values } = typeOptions;

    if (!Array.isArray(values) || values.length === 0) {
      throw kerror.get(
        "validation",
        "assert",
        "invalid_type",
        "values",
        "string[]",
      );
    }

    const nonString = values.filter((value) => typeof value !== "string");

    if (nonString.length > 0) {
      throw kerror.get(
        "validation",
        "assert",
        "invalid_type",
        "values",
        "string[]",
      );
    }

    return typeOptions;
  }
}

export = EnumType;
