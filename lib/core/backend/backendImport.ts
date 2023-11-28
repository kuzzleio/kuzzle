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

import * as kerror from "../../kerror";
import { ApplicationManager } from "./index";
import { JSONObject } from "../../../index";
import { isPlainObject } from "../../../lib/util/safeObject";

const assertionError = kerror.wrap("validation", "assert");
const runtimeError = kerror.wrap("plugin", "runtime");

export type DefaultMappings = {
  [index: string]: {
    [collection: string]: {
      mappings: JSONObject;
      settings?: JSONObject;
    };
  };
};

export class BackendImport extends ApplicationManager {
  /**
   * Import mappings.
   *
   * @example
   * {
   *   index1: {
   *     collection1: { mappings, settings },
   *     collection2: { mappings, settings }
   *     ...
   *   },
   *   index2: { ... },
   *   ...
   * }
   *
   * @param mappings Object containing index and their collections mappings
   */
  mappings(mappings: DefaultMappings): void {
    if (this._application.started) {
      throw runtimeError.get("already_started", "import");
    } else if (!isPlainObject(mappings)) {
      throw assertionError.get("invalid_type", "mappings", "object");
    }

    for (const index of Object.keys(mappings)) {
      if (!isPlainObject(mappings[index])) {
        throw assertionError.get("invalid_type", `mappings.${index}`, "object");
      }
      // If some collections have already been defined, only their last mappings will be retained
      this._application._import.mappings[index] = Object.assign(
        {},
        this._application._import.mappings[index],
        mappings[index],
      );
    }
  }

  /**
   * Import profiles.
   *
   * @example
   * {
   *   profileA: { profile definition },
   *   profileB: { profile definition },
   *   ...
   * }
   *
   * @param profiles Object containing profiles and their definition
   */
  profiles(profiles: JSONObject): void {
    if (this._application.started) {
      throw runtimeError.get("already_started", "import");
    } else if (!isPlainObject(profiles)) {
      throw assertionError.get("invalid_type", "profiles", "object");
    }

    // If some profiles have already been defined, only their last definition will be retained
    this._application._import.profiles = Object.assign(
      {},
      this._application._import.profiles,
      profiles,
    );
  }

  /**
   * Import roles
   *
   * @example
   * {
   *   roleA: { role definition },
   *   roleB: { role definition },
   *   ...
   * }
   *
   * @param roles Object containing roles and their definition
   */
  roles(roles: JSONObject): void {
    if (this._application.started) {
      throw runtimeError.get("already_started", "import");
    } else if (!isPlainObject(roles)) {
      throw assertionError.get("invalid_type", "roles", "object");
    }

    // If some roles have already been defined, only their last definition will be retained
    this._application._import.roles = Object.assign(
      {},
      this._application._import.roles,
      roles,
    );
  }

  /**
   * Import user mappings.
   *
   * @example
   * {
   *   properties: {
   *     fieldA: { type: 'keyword' },
   *     fieldB: { type: 'integer' },
   *     ...
   *   }
   * }
   *
   * @param mappings User properties
   */
  userMappings(mappings: JSONObject): void {
    if (this._application.started) {
      throw runtimeError.get("already_started", "import");
    } else if (!isPlainObject(mappings)) {
      throw assertionError.get("invalid_type", "mappings", "object");
    }

    this._application._import.userMappings = mappings;
  }

  /**
   * Import users.
   *
   * @example
   * {
   *   kuidA: { user content },
   *   kuidB: { user content },
   * }
   *
   * @param users Object containing users and their content
   * @param options onExistingUsers: Default to `skip`. Strategy to adopt when trying to create an already existing user.
   */
  users(
    users: JSONObject,
    options: { onExistingUsers?: "overwrite" | "skip" } = {},
  ): void {
    if (this._application.started) {
      throw runtimeError.get("already_started", "import");
    } else if (!isPlainObject(users)) {
      throw assertionError.get("invalid_type", "users", "object");
    } else if (options.onExistingUsers) {
      if (
        !(
          options.onExistingUsers === "overwrite" ||
          options.onExistingUsers === "skip"
        )
      ) {
        throw assertionError.get("invalid_type", "onExistingUsers", [
          "overwrite",
          "skip",
        ]);
      }
      this._application._import.onExistingUsers = options.onExistingUsers;
    }

    // If some users have already been defined (before startup), only their last definition will be retained
    this._application._import.users = Object.assign(
      {},
      this._application._import.users,
      users,
    );
  }
}
