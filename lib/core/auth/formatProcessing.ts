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

import { Profile } from "../../model/security/profile";
import { Role } from "../../model/security/role";
import { User } from "../../model/security/user";

import type { Serialized } from "../../types/core/auth/formatProcessing.type";

export default {
  /**
   * Serializes profile and transforms it into a POJO
   *
   * @param {Profile} profile
   * @returns {object}
   */
  serializeProfile(profile: Profile): Serialized<Profile> {
    const { _id, ..._source } = profile;

    return { _id, _source: _source as Record<string, any> };
  },

  /**
   * Serializes role and transforms it into a POJO
   *
   * @param {Role} role
   * @returns {Object}
   */
  serializeRole(role: Role & { restrictedTo?: unknown }): Serialized<Role> {
    const { _id, ..._source } = role;

    return { _id, _source: _source as Record<string, any> };
  },

  /**
   * Serializes user and transforms it into a POJO
   *
   * @param {User} user
   * @returns {Object}
   */
  serializeUser(user: User): Serialized<User> {
    const { _id, ..._source } = user;

    return { _id, _source: _source as Record<string, any> };
  },
};
