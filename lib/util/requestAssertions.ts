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

import isNil from "lodash/isNil";

import type { KuzzleRequest } from "../api/request";
import * as kerror from "../kerror";
import { get, isPlainObject } from "./safeObject";

const assertionError = kerror.wrap("api", "assert");

export function assertArgsHasAttribute(
  request: KuzzleRequest,
  attribute: string,
): void {
  if (isNil(get(request.input.args, attribute))) {
    throw assertionError.get("missing_argument", attribute);
  }
}

/**
 * Note: Assumes assertHasBody has been called first
 */
export function assertBodyAttributeType(
  request: KuzzleRequest,
  attribute: string,
  type: string,
): boolean {
  switch (type) {
    case "number":
    case "boolean":
    case "string":
      // The body should always be passed as JSON, we don't consider type conversion possibilities
      if (typeof get(request.input.body, attribute) === type) {
        return true;
      }
      break;
    case "array":
      if (Array.isArray(get(request.input.body, attribute))) {
        return true;
      }
      break;
    case "object":
      if (isPlainObject(get(request.input.body, attribute))) {
        return true;
      }
      break;
    default:
      throw assertionError.get("unexpected_type_assertion", type, attribute);
  }

  throw assertionError.get("invalid_type", `body.${attribute}`, type);
}

export function assertBodyHasAttribute(
  request: KuzzleRequest,
  attribute: string,
): void {
  if (isNil(get(request.input.body, attribute))) {
    throw assertionError.get("missing_argument", `body.${attribute}`);
  }
}

export function assertBodyHasNotAttribute(
  request: KuzzleRequest,
  attribute: string,
): void {
  if (!isNil(get(request.input.body, attribute))) {
    throw assertionError.get("forbidden_argument", `body.${attribute}`);
  }
}

/**
 * Note: Assumes content exists
 */
export function assertHasBody(request: KuzzleRequest): void {
  if (isNil(request.input.body)) {
    throw assertionError.get("body_required");
  }
}

export function assertHasId(request: KuzzleRequest): void {
  if (!request.input.args._id) {
    throw assertionError.get("missing_argument", "_id");
  }
}

export function assertHasIndex(request: KuzzleRequest): void {
  if (!request.input.args.index) {
    throw assertionError.get("missing_argument", "index");
  }
}

export function assertHasIndexAndCollection(request: KuzzleRequest): void {
  if (!request.input.args.index) {
    throw assertionError.get("missing_argument", "index");
  }

  if (!request.input.args.collection) {
    throw assertionError.get("missing_argument", "collection");
  }
}

export function assertIsAuthenticated(
  anonymousId: string,
  request: KuzzleRequest,
): void {
  if (request.context.user._id === anonymousId) {
    throw kerror.get("security", "rights", "unauthorized");
  }
}

export function assertIsObject(value: unknown): void {
  if (!isPlainObject(value)) {
    throw assertionError.get("invalid_argument", value, "object");
  }
}
