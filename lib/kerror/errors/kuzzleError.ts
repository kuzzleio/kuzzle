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
   * Undefined for an error built by hand rather than from the code registry
   * (`new BadRequestError("...")`), which both plugins and Kuzzle itself do.
   */
  public code: number | undefined;

  /**
   * Error unique identifier
   *
   * Undefined under the same conditions as {@link code}.
   */
  public id: string | undefined;

  /**
   * Placeholders used to construct the error message.
   */
  public props: string[] | undefined;

  /**
   * `message` has a default because callers really do omit it:
   * `doc/build-error-codes.js` constructs one of each class with no arguments
   * just to read its `status`, and plugin code in JavaScript may do the same.
   * That produced an error with an empty message before this file was typed,
   * and it still does.
   */
  constructor(
    message: string | Error = "",
    status: number,
    id?: string,
    code?: number,
  ) {
    super(typeof message === "string" ? message : message.message);

    this.status = status;
    this.code = code;
    this.id = id;
    this.props = undefined;
    this.stack = undefined;

    if (util.types.isNativeError(message)) {
      this.message = message.message;
      this.stack = message.stack;
    } else {
      this.message = message;
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
