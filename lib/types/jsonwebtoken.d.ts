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
 * `jsonwebtoken` 9.x ships no types. Declared here rather than depended on
 * through `@types/jsonwebtoken`, the same reasoning as `didyoumean.d.ts`: a
 * dependency change is not a typing slice's to make.
 *
 * Only what `tokenRepository` calls is declared — `sign`, `verify` and the two
 * error classes it discriminates on. The package's `decode`, its async
 * callback forms and the rest of its option surface are not, because an unused
 * declaration is a claim nothing checks.
 */
declare module "jsonwebtoken" {
  /** Thrown for a malformed or mis-signed token. */
  class JsonWebTokenError extends Error {
    constructor(message: string, error?: Error);
  }

  /** Thrown for a well-formed token past its `exp`. Extends the above. */
  class TokenExpiredError extends JsonWebTokenError {
    expiredAt: Date;

    constructor(message: string, expiredAt: Date);
  }

  type SignOptions = {
    algorithm?: string;
    expiresIn?: number | string;
    [option: string]: unknown;
  };

  /**
   * @returns the encoded token
   */
  function sign(
    payload: Record<string, unknown>,
    secret: string,
    options?: SignOptions,
  ): string;

  /**
   * @returns the decoded payload
   *
   * @throws {JsonWebTokenError} when the token does not verify
   * @throws {TokenExpiredError} when it verified but has expired
   */
  function verify(token: string, secret: string): Record<string, any>;
}
