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

import { KuzzleError } from "./kuzzleError";

export class PartialError extends KuzzleError {
  public errors: Array<KuzzleError>;
  public count: number;

  constructor(message?: string | Error, id?: string, code?: number);
  constructor(
    message?: string | Error,
    body?: KuzzleError[],
    id?: string,
    code?: number,
  );
  /**
   * v2.56.0 declared all four arguments untyped: a body that is not a list of
   * `KuzzleError` (`[{ _id, reason }]`, `Error[]`) compiled, and must still.
   */
  constructor(message?: unknown, body?: unknown, id?: unknown, code?: unknown);
  /**
   * Two call shapes, both public API: the documented one carries the partial
   * errors — `(message, body, id, code)` — and the one `kerror` uses for every
   * other error class — `(message, id, code)`. They are told apart the way
   * they always were: a numeric third argument with no fourth means the
   * arguments are shifted by one.
   */
  constructor(
    message: unknown = "",
    body?: unknown,
    id?: unknown,
    code?: unknown,
  ) {
    let errors: KuzzleError[] = [];
    let errorId: string | undefined;
    let errorCode: unknown;

    if (code === undefined && typeof id === "number") {
      errorCode = id;
      errorId = typeof body === "string" ? body : undefined;
    } else {
      errorId = typeof id === "string" ? id : undefined;
      errorCode = code;

      if (Array.isArray(body)) {
        errors = body;
      }
    }

    super(message, 206, errorId, errorCode);

    this.errors = errors;
    this.count = errors.length;
  }

  toJSON() {
    const serialized = super.toJSON();

    serialized.errors = this.errors;
    serialized.count = this.count;

    return serialized;
  }
}
