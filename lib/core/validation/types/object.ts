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
import { ObjectTypeOptions } from "../typeOptions";

const kerror = wrap("validation", "assert");

class ObjectType extends BaseType<ObjectTypeOptions> {
  public typeName = "object";
  public allowChildren = true;
  public allowedTypeOptions = ["strict"];

  validate(
    typeOptions: ObjectTypeOptions,
    fieldValue: unknown,
    errorMessages: string[],
  ): boolean {
    if (
      fieldValue === null ||
      typeof fieldValue !== "object" ||
      Array.isArray(fieldValue)
    ) {
      errorMessages.push("The value must be an object.");
      return false;
    }

    return true;
  }

  /**
   * @throws {PreconditionError}
   */
  validateFieldSpecification(
    typeOptions: ObjectTypeOptions,
  ): ObjectTypeOptions {
    if (has(typeOptions, "strict") && typeof typeOptions.strict !== "boolean") {
      throw kerror.get("invalid_type", "strict", "boolean");
    }

    return typeOptions;
  }

  /**
   * @throws KuzzleInternalError
   */
  getStrictness(
    typeOptions: ObjectTypeOptions,
    parentStrictness: boolean,
  ): boolean {
    if (typeOptions.strict === undefined) {
      return parentStrictness;
    }

    return typeOptions.strict;
  }
}

export = ObjectType;
