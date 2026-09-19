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

import type { KuzzleRequest } from "./request";

class RateLimiter {
  private readonly loginsPerSecond: number;
  private frame: { [connectionId: string]: number };
  private frameResetTimer: NodeJS.Timeout | null;

  constructor() {
    this.loginsPerSecond = global.kuzzle.config.limits.loginsPerSecond;
    this.frame = {};
    this.frameResetTimer = null;
  }

  init() {
    this.frameResetTimer = setInterval(() => (this.frame = {}), 1000);
  }

  /**
   * Return a boolean indicating whether a request execution is allowed as per
   * the rate restriction configuration.
   *
   * auth:login is limited by the limits.loginsPerSecond configuration
   * auth:logout is NOT limited for authenticated users
   *
   * @param  {Request}  request
   * @returns {Boolean}
   */
  async isAllowed(request: KuzzleRequest): Promise<boolean> {
    const { controller, action } = request.input;
    let count = 0;
    let limit = -1;

    if (controller === "auth" && action === "login") {
      // A request context can carry no connection id — internal requests do
      // not have one. They have always shared a single bucket under the
      // stringified `null`; keeping that key preserves the limit rather than
      // quietly lifting it for whoever can reach this without a connection.
      const cid = request.context.connection.id ?? "null";

      count = this.frame[cid] = (this.frame[cid] || 0) + 1;
      limit = this.loginsPerSecond;
    } else {
      const user = request.getUser();

      // No user resolved means no profile, and a profile's rateLimit is the
      // only thing this branch reads. Falling through would leave `limit` at
      // -1 and deny the request, which is not what "unlimited" means.
      if (user === null) {
        return true;
      }

      const { _id, profileIds } = user;

      // By definition, auth:logout should be unrestricted
      if (_id !== "-1" && controller === "auth" && action === "logout") {
        return true;
      }

      limit = await this.profilesLimit(profileIds);

      if (limit > 0) {
        count = this.frame[_id] = (this.frame[_id] || 0) + 1;
      }
    }

    return limit === 0 || count <= limit;
  }

  /**
   * The rate limit a user's profiles impose, as a single number: 0 is
   * unlimited, and one unlimited profile makes the whole set unlimited.
   *
   * Extracted from isAllowed(), whose cognitive complexity this loop pushed
   * past the gate once the null-user branch above was added.
   */
  private async profilesLimit(profileIds: string[]): Promise<number> {
    const profiles = await global.kuzzle.ask(
      "core:security:profile:mGet",
      profileIds,
    );

    let limit = -1;

    for (const profile of profiles) {
      const { rateLimit = 0 } = profile;

      if (limit === 0 || rateLimit === 0) {
        limit = 0;
      } else {
        limit = Math.max(limit, rateLimit);
      }
    }

    return limit;
  }
}

export = RateLimiter;
