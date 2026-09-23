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

/**
 * The pure helpers `validation.ts` curates and validates with.
 *
 * They live here because they are the unit a spec has to reach: a tree
 * assembled from field paths, a parent lookup, a property whitelist, and the
 * one place the verbose/fail-fast choice is made. `validation.ts` uses
 * `export =`, which cannot carry named exports beside it, so the only way for
 * a test to address these by name was `rewire`'s `__get__` — a private binding
 * reached through the compiled scope (ADR-0001, step 13 L6f).
 */
import type { JSONObject } from "kuzzle-sdk";

import * as kerror from "../../kerror";
import { get, isPlainObject } from "../../util/safeObject";
import type {
  CuratedFieldSpecification,
  ErrorMessages,
  FieldErrorScope,
  RawSpecification,
  StructuredFieldSpecification,
  VerboseErrorMessages,
} from "./specification";

const assertionError = kerror.wrap("validation", "assert");

/**
 * Narrows `object` to a plain object holding none but the allowed properties.
 */
export function checkAllowedProperties(
  object: unknown,
  allowedProperties: string[],
): object is Record<string, unknown> {
  if (!isPlainObject(object)) {
    return false;
  }

  return !Object.keys(object).some(
    (propertyName) => !allowedProperties.includes(propertyName),
  );
}

/**
 * Assembles curated fields, grouped by depth, into the tree the validator
 * walks. Depth counting starts at 1.
 *
 * @throws {PreconditionError}
 */
export function curateStructuredFields(
  typeAllowsChildren: string[],
  fields: Record<number, CuratedFieldSpecification[]>,
  maxDepth: number,
): StructuredFieldSpecification {
  const structuredFields: StructuredFieldSpecification = {
    children: {},
    root: true,
  };

  for (let i = 1; i <= maxDepth; i++) {
    const sameDepth = fields[i];

    if (sameDepth === undefined) {
      throw assertionError.get("missing_nested_spec");
    }

    sameDepth.forEach((field) => {
      const parent = getParent(structuredFields, field.path),
        // `path` is a field's key split on "/", so it always has a last
        // segment; the fallback is what makes that readable to the compiler.
        childKey = field.path.at(-1) ?? "";

      if (!parent.root && !typeAllowsChildren.includes(parent.type ?? "")) {
        throw assertionError.get("unexpected_children", parent.type);
      }

      const children = (parent.children ??= {});

      children[childKey] = field;
    });
  }

  return structuredFields;
}

/**
 * Walks a field's path down the tree and answers the node that must hold it.
 *
 * @throws {PreconditionError} when an intermediate node is missing
 */
export function getParent(
  structuredFields: StructuredFieldSpecification,
  fieldPath: string[],
): StructuredFieldSpecification {
  if (fieldPath.length === 1) {
    return structuredFields;
  }

  let pointer: StructuredFieldSpecification = structuredFields;

  for (const segment of fieldPath.slice(0, -1)) {
    const child = pointer.children?.[segment];

    if (child === undefined) {
      throw assertionError.get("missing_parent", fieldPath.join("."));
    }

    pointer = child;
  }

  return pointer;
}

/**
 * Files a validation message, or throws it.
 *
 * When `structured` holds, the message is hung off `errorHolder` at the field's
 * own path so the caller can report it in place; when it does not, the first
 * message throws and the holder is never written to.
 *
 * @throws {BadRequestError} when `structured` is false
 */
export function storeErrorMessage(
  errorContext: string | string[],
  errorHolder: VerboseErrorMessages,
  message: string,
): void {
  if (errorContext === "document") {
    const documentScope = (errorHolder.documentScope ??= []);

    documentScope.push(message);
    return;
  }

  let pointer: FieldErrorScope = (errorHolder.fieldScope ??= {});

  for (const segment of errorContext) {
    const children = (pointer.children ??= {});

    pointer = children[segment] ??= {};
  }

  const messages = (pointer.messages ??= []);

  messages.push(message);
}

export function throwErrorMessage(
  errorContext: string | string[],
  message: string,
): never {
  if (errorContext === "document") {
    throw kerror.get("validation", "check", "failed_document", message);
  }

  // Everything that is not the "document" literal is a field path.
  throw kerror.get(
    "validation",
    "check",
    "failed_field",
    Array.isArray(errorContext) ? errorContext.join(".") : errorContext,
    message,
  );
}

export function manageErrorMessage(
  errorContext: string | string[],
  errorHolder: ErrorMessages,
  message: string,
  structured: boolean,
): void {
  if (!structured) {
    throwErrorMessage(errorContext, message);
  }

  // `structured` and the holder's shape are the same fact: `validate` builds an
  // object exactly when `verbose` holds, and a list when it does not. The
  // narrowing is what says so; the branch cannot be taken.
  if (Array.isArray(errorHolder)) {
    return;
  }

  storeErrorMessage(errorContext, errorHolder, message);
}

/**
 * Reads every stored specification, falling back to the one in the
 * configuration when the internal index holds none — the database is not
 * necessarily prepared yet when this first runs.
 */
function collectStoredSpecification(
  validation: RawSpecification,
  hit: { _id: string; _source: JSONObject },
): void {
  const { _id, _source } = hit;
  const collectionName = `${_id.split("#")[0]}/${_id.split("#")[1]}`;

  for (const required of ["index", "collection", "validation"]) {
    if (!get(_source, required)) {
      throw assertionError.get(
        "incorrect_validation_format",
        collectionName,
        required,
      );
    }
  }

  const indexValidation = (validation[_source.index] ??= {});

  indexValidation[_source.collection] = _source.validation;
}

export function getValidationConfiguration(): Promise<RawSpecification> {
  return global.kuzzle.internalIndex
    .search("validations", {}, { from: 0, size: 1000 })
    .then((result) => {
      if (!result || !Array.isArray(result.hits) || result.hits.length === 0) {
        // We can't wait prepareDb as it runs outside of the rest of the start
        return global.kuzzle.config.validation || {};
      }

      const validation: RawSpecification = {};

      for (const hit of result.hits) {
        collectStoredSpecification(validation, hit);
      }

      return validation;
    });
}
