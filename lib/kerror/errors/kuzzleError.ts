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

import * as util from "util";

import type { JSONObject } from "kuzzle-sdk";

/**
 * `util.types.isNativeError` rather than `instanceof Error`: it answers true
 * for an error built in another realm, which `instanceof` does not, and false
 * for an object that merely has `Error.prototype`. Node deprecates it in
 * favour of `Error.isError`, which needs Node 24 while this package supports
 * `>=20` — hence the NOSONAR. Revisit when the floor moves.
 */
function isError(value: unknown): value is Error {
  return util.types.isNativeError(value); // NOSONAR
}

/**
 * API error are instances of this class.
 * See https://docs.kuzzle.io/core/2/api/errors/types/
 */
export class KuzzleError extends Error {
  /**
   * HTTP status code
   */
  public status: number;

  /**
   * Error unique code
   * @see https://docs.kuzzle.io/core/2/api/errors/error-codes/
   *
   * Set on every error built from the code registry (`kerror`), which is how
   * Kuzzle builds its own; undefined on an error built by hand
   * (`new BadRequestError("...")`), which plugins and Kuzzle itself also do.
   * Declared as always present all the same, because that is what v2.56.0
   * declared and what code compiled against it reads. See the constructor.
   */
  public code!: number;

  /**
   * Error unique identifier
   *
   * Undefined under the same conditions as {@link code}, and declared as
   * always present for the same reason.
   */
  public id!: string;

  /**
   * The placeholders that were substituted into the message, when `kerror`
   * built the error; undefined otherwise. `kerror.get` takes them from its
   * caller, which may hand it anything — an id, a count, the value that
   * failed a type check — but `string[]` is what v2.56.0 declared, and code
   * compiled against it assigns this to a `string[]`.
   */
  public props!: string[];

  /**
   * The arguments are not narrowed to what they are meant to be (a string or
   * an `Error`, a string id, a numeric code): v2.56.0's subclasses took
   * untyped ones, so `new InternalError(caught)` with a `catch` variable of
   * type `unknown` compiled, and must still.
   *
   * A `message` that is not an `Error` is stringified, as `Error` itself
   * does; `undefined` and `null` give an empty one — `doc/build-error-codes.js`
   * constructs one of each class with no arguments just to read its `status`.
   *
   * @param message - a string, or an `Error` whose message and stack are kept
   * @param status - HTTP status code
   * @param id - error unique identifier (a string)
   * @param code - error unique code (a number)
   */
  constructor(message: unknown, status: number, id?: unknown, code?: unknown) {
    super(isError(message) ? message.message : String(message ?? ""));

    this.status = status;
    // The three fields declared above as always present, stored as handed:
    // their declarations are the ones code compiled against v2.56.0 reads,
    // not a description of every value that reaches this line.
    Object.assign(this, { code, id, props: undefined });
    this.stack = undefined;

    if (isError(message)) {
      this.stack = message.stack;
    } else {
      Error.captureStackTrace(this, KuzzleError);
    }
  }

  /**
   * Error class name (e.g: 'NotFoundError')
   */
  get name(): string {
    return this.constructor.name;
  }

  toJSON(): JSONObject {
    return {
      code: this.code,
      id: this.id,
      message: this.message,
      props: this.props,
      stack: this.stack,
      status: this.status,
    };
  }
}
