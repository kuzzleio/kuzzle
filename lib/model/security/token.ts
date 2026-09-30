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

export interface TokenContent {
  /**
   * Token ID (also Redis key)
   *
   * @example `${userId}#${jwt}`
   */
  _id?: string;
  expiresAt?: number;
  ttl?: number;
  userId?: string;
  connectionIds?: string[];
  jwt?: string;
  refreshed?: boolean;
  singleUse?: boolean;
}

/**
 * Represents a token that identify an user.
 */
export class Token implements TokenContent {
  /**
   * The constructor writes `null` for any of these five its `TokenContent`
   * did not carry, and a `Token` is routinely built empty —
   * `Token.Anonymous()` and the repository's cache miss both do it (ADR-0001,
   * TD-62). They are declared non-nullable all the same, as v2.56.0 declared
   * them: plugins read `request.context.token.userId` as a `string`, and
   * `| null` broke that under `strict`.
   */
  _id: string;
  expiresAt: number;
  ttl: number;
  userId: string;
  jwt: string;
  refreshed: boolean;
  singleUse: boolean;

  constructor(data: TokenContent = {}) {
    this._id = data._id || null!;
    this.expiresAt = data.expiresAt || null!;
    this.ttl = data.ttl || null!;
    this.userId = data.userId || null!;
    this.jwt = data.jwt || null!;
    this.refreshed = Boolean(data.refreshed);
    this.singleUse = Boolean(data.singleUse);
  }

  get type(): "apiKey" | "authToken" {
    if (this.jwt && this.jwt.startsWith(Token.APIKEY_PREFIX)) {
      return "apiKey";
    }

    return "authToken";
  }

  static get AUTH_PREFIX() {
    return "kauth-";
  }
  static get APIKEY_PREFIX() {
    return "kapikey-";
  }
}
