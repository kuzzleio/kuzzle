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

import { JSONObject } from "kuzzle-sdk";
import { isEmpty } from "lodash";
import Bluebird from "bluebird";

import { Request } from "../../api/request";
import { assertIsObject } from "../../util/requestAssertions";
import * as kerror from "../../kerror";
import { Logger } from "../../kuzzle/Logger";
import "../../types/Global";

/**
 * A `{ _id: body }` map, as the security fixtures / import payloads express
 * roles, profiles and users.
 */
type SecurityObjects = Record<string, JSONObject>;

interface SecurityPermissions {
  roles?: SecurityObjects;
  profiles?: SecurityObjects;
  users?: SecurityObjects;
}

/**
 * How to react to users that already exist when importing.
 */
type OnExistingUsers = "fail" | "skip" | "overwrite";

interface LoadOptions {
  force?: boolean;
  onExistingUsers?: OnExistingUsers;
  onExistingUsersWarning?: boolean;
  refresh?: string;
  user?: JSONObject | null;
}

/**
 * @class SecurityLoader
 */
class SecurityLoader {
  public logger: Logger;

  constructor() {
    this.logger = global.kuzzle.log.child("core:security:loader");
  }

  async init() {
    /**
     * Loads permissions into the app
     * @param {Object} permissions Object containing roles, profiles and users
     * @param {Object} opts - force, onExistingUsers (fail), onExistingUsersWarning (false), user (null)
     */
    global.kuzzle.onAsk(
      "core:security:load",
      (json: SecurityPermissions, opts: LoadOptions) => this.load(json, opts),
    );
  }

  async load(
    permissions: SecurityPermissions = {},
    {
      force,
      onExistingUsers = "fail",
      onExistingUsersWarning = false,
      refresh = "false",
      user = null,
    }: LoadOptions = {},
  ) {
    assertIsObject(permissions);

    await this._create("createOrReplaceRole", permissions.roles, "roles", {
      force,
      refresh,
      user,
    });

    await this._create(
      "createOrReplaceProfile",
      permissions.profiles,
      "profiles",
      { refresh, user },
    );

    const usersToLoad = await this._getUsersToLoad(permissions.users, {
      onExistingUsers,
      warning: onExistingUsersWarning,
    });

    await this._create("createUser", usersToLoad, "users", { refresh, user });
  }

  async _create(
    action: string,
    objects: SecurityObjects | undefined,
    collection: string,
    {
      force,
      refresh,
      user,
    }: Pick<LoadOptions, "force" | "refresh" | "user"> = {},
  ) {
    if (!objects) {
      return;
    }

    assertIsObject(objects);

    const promises = [];

    for (const [_id, body] of Object.entries(objects)) {
      assertIsObject(body);

      const request = new Request(
        {
          _id,
          action,
          body,
          controller: "security",
          force,
          refresh,
        },
        { user },
      );

      promises.push(global.kuzzle.funnel.processRequest(request));
    }

    await Bluebird.all(promises);

    await global.kuzzle.internalIndex.refreshCollection(collection);
  }

  async _getUsersToLoad(
    users: SecurityObjects | undefined,
    {
      onExistingUsers,
      warning,
    }: { onExistingUsers?: OnExistingUsers; warning?: boolean } = {},
  ) {
    if (isEmpty(users)) {
      return users;
    }

    const ids = Object.keys(users);
    const mGetUsers = new Request({
      action: "mGetUsers",
      body: { ids },
      controller: "security",
    });

    const { result } = await global.kuzzle.funnel.processRequest(mGetUsers);

    const existingUserIds = result.hits.map(({ _id }: { _id: string }) => _id);

    if (existingUserIds.length === 0) {
      return users;
    }

    if (onExistingUsers === "fail") {
      throw kerror.get("security", "user", "prevent_overwrite");
    } else if (onExistingUsers === "skip") {
      if (warning) {
        this.logger.info(`Users skipped during import: ${existingUserIds}`);
      }
      return Object.entries(users).reduce<SecurityObjects>(
        (memo, [userId, content]) => {
          if (!existingUserIds.includes(userId)) {
            memo[userId] = content;
          }

          return memo;
        },
        {},
      );
    } else if (onExistingUsers === "overwrite") {
      if (warning) {
        this.logger.info(`Users overwritten during import: ${existingUserIds}`);
      }
      const mDeleteUsers = new Request({
        action: "mDeleteUsers",
        body: { ids: existingUserIds },
        controller: "security",
        refresh: "wait_for",
      });

      await global.kuzzle.funnel.processRequest(mDeleteUsers);

      return users;
    } else {
      throw kerror.get(
        "api",
        "assert",
        "unexpected_argument",
        "onExistingUsers",
        ["skip", "overwrite", "fail"],
      );
    }
  }
}

export = SecurityLoader;
