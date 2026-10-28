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
import Bluebird from "bluebird";

import * as kerror from "../../kerror";
import { NativeController } from "./baseController";
import { MutexAcquireError, withLock } from "../../util/distributedLock";
import type { KuzzleRequest } from "../request";
import type { User } from "../../model/security/user";
import type { ResetSecurityResult } from "../../types/controllers/ResetSecurityResult";
import type { KuzzleLogger } from "kuzzle-logger";

/**
 * @class AdminController
 */
class AdminController extends NativeController {
  protected shuttingDown: boolean;
  protected logger: KuzzleLogger;

  constructor() {
    super([
      "dump",
      "loadFixtures",
      "loadMappings",
      "loadSecurities",
      "refreshIndexCache",
      "resetCache",
      "resetDatabase",
      "resetSecurity",
      "shutdown",
    ]);

    this.shuttingDown = false;
    this.logger = global.kuzzle.log.child("api:controllers:admin");
  }

  async refreshIndexCache() {
    await global.kuzzle.ask("core:storage:public:cache:refresh");
  }

  /**
   * Reset Redis cache
   */
  async resetCache(request: KuzzleRequest) {
    const database = request.getString("database");

    // @todo allow only memoryStorage
    if (database === "internalCache") {
      await this.ask("core:cache:internal:flushdb");
    } else if (database === "memoryStorage") {
      await this.ask("core:cache:public:flushdb");
    } else {
      throw kerror.get("services", "cache", "database_not_found", database);
    }

    return { acknowledge: true };
  }

  /**
   * Reset all roles, profiles and users
   */
  async resetSecurity() {
    return this.failIfLocked(
      "resetSecurity",
      "Kuzzle is already reseting roles, profiles and users.",
      async () => {
        const result: ResetSecurityResult = {};
        const options = { refresh: "wait_for" };

        result.deletedUsers = await this.ask(
          "core:security:user:truncate",
          options,
        );
        result.deletedProfiles = await this.ask(
          "core:security:profile:truncate",
          options,
        );
        result.deletedRoles = await this.ask(
          "core:security:role:truncate",
          options,
        );

        await global.kuzzle.internalIndex.createInitialSecurities();

        await this.ask(
          "core:cache:internal:del",
          `backend:init:import:permissions`,
        );

        return result;
      },
    );
  }

  /**
   * Reset all indexes created by users
   */
  async resetDatabase() {
    return this.failIfLocked(
      "resetDatabase",
      "Kuzzle is already reseting all indexes.",
      async () => {
        const indexes = await this.ask("core:storage:public:index:list");
        await this.ask("core:storage:public:index:mDelete", indexes);

        await this.ask(
          "core:cache:internal:del",
          `backend:init:import:mappings`,
        );

        return { acknowledge: true };
      },
    );
  }

  /**
   * Runs `callback` under the `resource` lock, or refuses the action right
   * away if another node or request already holds it
   */
  private async failIfLocked<T>(
    resource: string,
    message: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    let acquired = false;

    try {
      return await withLock(
        resource,
        async () => {
          acquired = true;
          return callback();
        },
        { retryAttempts: 0 },
      );
    } catch (error) {
      // The same error thrown from inside the callback is not this lock
      if (!acquired && error instanceof MutexAcquireError) {
        throw kerror.get("api", "process", "action_locked", message);
      }

      throw error;
    }
  }

  /**
   * Generate a dump
   * Kuzzle will throw a PreconditionError if a dump is already running
   */
  dump(request: KuzzleRequest) {
    const waitForRefresh = request.getRefresh("wait_for");
    const suffix = request.getString("suffix", "manual-api-action");

    const promise = global.kuzzle.dump(suffix);

    return this._waitForAction(waitForRefresh, promise);
  }

  /**
   * Shutdown Kuzzle
   */
  async shutdown() {
    if (this.shuttingDown) {
      throw kerror.get(
        "api",
        "process",
        "action_locked",
        "Kuzzle is already shutting down.",
      );
    }

    this.shuttingDown = true;
    // Not awaited, so that this request is answered first. It never rejects.
    void global.kuzzle.shutdown();

    return { acknowledge: true };
  }

  /**
   * Always waits for the import, so that a failure is reported to the caller:
   * `refresh=false` only skips waiting for the documents to be indexed.
   */
  async loadFixtures(request: KuzzleRequest) {
    const fixtures = request.getBody();
    const refresh = request.getRefresh("wait_for");

    await global.kuzzle.ask("core:storage:public:document:import", fixtures, {
      refresh,
    });

    // The documented answer. 2.17.6 to 2.59 answered `null` instead.
    return { acknowledge: true };
  }

  loadMappings(request: KuzzleRequest) {
    const mappings = request.getBody();

    return this._waitForAction(
      request.getRefresh("wait_for"),
      global.kuzzle.ask("core:storage:public:mappings:import", mappings, {
        rawMappings: true,
      }),
    );
  }

  async loadSecurities(request: KuzzleRequest) {
    const permissions = request.getBody();
    const user: User | null = request.getUser();
    const onExistingUsers = request.input.args.onExistingUsers;
    const force = request.getBoolean("force");
    const waitForRefresh = request.getRefresh("wait_for");

    const promise = this.ask("core:security:load", permissions, {
      force,
      onExistingUsers,
      refresh: waitForRefresh,
      user,
    });

    return this._waitForAction(waitForRefresh, promise);
  }

  _waitForAction(
    waitForRefresh: string,
    promise: Promise<unknown>,
  ): Promise<{ acknowledge: boolean }> {
    const result = { acknowledge: true };

    if (waitForRefresh === "false") {
      // Attaching an error handler to the provided promise to prevent
      // uncaught rejections
      promise.catch((err) => this.logger.error(err));

      return Bluebird.resolve(result);
    }

    return promise.then(() => result);
  }
}

export = AdminController;
