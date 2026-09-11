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

import { TypeOptions } from "./typeOptions";

/**
 * Base class of every validation type, and the contract `Validation.addType`
 * checks a plugin-provided type against.
 *
 * @typeParam TOptions - the `typeOptions` shape this type accepts
 */
class BaseType<TOptions extends TypeOptions = TypeOptions> {
  /** Name under which the type is registered */
  public typeName = "";

  /** Whether fields of that type may declare children */
  public allowChildren = false;

  /** `typeOptions` properties the type recognizes */
  public allowedTypeOptions: string[] = [];

  /**
   * Validate a document against a registered field type validator
   */
  validate(
    typeOptions?: TOptions,
    fieldValue?: unknown,
    errorMessages?: string[],
  ): boolean;
  validate(): boolean {
    return true;
  }

  /**
   * Validate a field specification itself
   *
   * @throws {KuzzleError}
   */
  validateFieldSpecification(opts: TOptions): TOptions {
    return opts;
  }

  /**
   * Narrows `object` to a plain object holding none but the allowed properties.
   */
  checkAllowedProperties(
    object: unknown,
    allowedProperties: string[],
  ): object is Record<string, unknown> {
    if (
      typeof object !== "object" ||
      Array.isArray(object) ||
      object === null
    ) {
      return false;
    }

    return !Object.keys(object).some(
      (propertyName) => !allowedProperties.includes(propertyName),
    );
  }

  getStrictness(fieldSpec: TOptions, parentStrictness: boolean): boolean {
    return parentStrictness;
  }
}

export = BaseType;
