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

import { inspect } from "node:util";

import { wrap } from "../../kerror";
import ClientAdapter from "./clientAdapter";
import { selectStorageDriver } from "./storageDriverLoader";
import { storeScopeEnum } from "./storeScopeEnum";
import type { Logger } from "../../kuzzle/Logger";
import "../../types/Global";

const kerror = wrap("services", "storage");

/**
 * How long the shutdown waits for a driver's `close()` hook: a requested
 * shutdown has no other time limit, and a hook that never settles must not
 * keep the node up
 */
const DRIVER_CLOSE_TIMEOUT = 5000;

class StorageEngine {
  public public: ClientAdapter;
  public private: ClientAdapter;
  public logger: Logger;
  /** The running close, shared by every `close()` call */
  private closing: Promise<void> | null = null;

  constructor() {
    // Storage client for public indexes only
    this.public = new ClientAdapter(storeScopeEnum.PUBLIC);

    // Storage client for private indexes only
    this.private = new ClientAdapter(storeScopeEnum.PRIVATE);
    this.logger = global.kuzzle.log.child("core:storage:storageEngine");

    const { description, identity, location } = selectStorageDriver(
      global.kuzzle.config.services.storageEngine,
    );

    this.logger.info(
      identity === null
        ? `[ℹ] Elasticsearch configuration is set to major version : ${global.kuzzle.config.services.storageEngine.majorVersion}`
        : // Where from: the application and Kuzzle may each have a copy
          `[ℹ] Storage driver: ${description} (${location})`,
    );

    for (const setting of global.kuzzle.config.internal?.ignoredSettings ??
      []) {
      this.logger.warn(
        `[⚠] ${setting} is ignored because services.storageEngine.driver is set: remove ${setting.split(".").pop()}.`,
      );
    }
  }

  /**
   * Initialize storage clients and perform integrity checks
   */
  async init(): Promise<void> {
    await Promise.all([this.public.init(), this.private.init()]);

    const privateIndexes = this.private.cache.listIndexes();
    const publicIndexes = this.public.cache.listIndexes();

    for (const publicIndex of publicIndexes) {
      if (privateIndexes.includes(publicIndex)) {
        throw kerror.get("index_already_exists", "public", publicIndex);
      }
    }

    this.logger.info("[✔] Storage initialized");
  }

  /**
   * Closes the driver instances of both scopes on shutdown, once the requests
   * in flight are done: calls their `close()` hook, when they have one, once.
   *
   * Never rejects, nor waits longer than `timeout` for a driver: a failure or
   * a timeout is logged, and the shutdown goes on.
   */
  close(timeout = DRIVER_CLOSE_TIMEOUT): Promise<void> {
    this.closing ??= Promise.all(
      [this.public, this.private].map((adapter) =>
        this.closeDriver(adapter, timeout),
      ),
    ).then(() => undefined);

    return this.closing;
  }

  private async closeDriver(
    { driver, scope }: ClientAdapter,
    timeout: number,
  ): Promise<void> {
    if (typeof driver.close !== "function") {
      return;
    }

    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        // A hook throwing synchronously is reported as one that rejects
        (async () => driver.close?.())(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`not closed after ${timeout}ms`)),
            timeout,
          );
        }),
      ]);
    } catch (error) {
      this.logger.warn(
        `[⚠] Unable to close the ${scope} storage driver: ${
          error instanceof Error ? error.message : inspect(error)
        }`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export = StorageEngine;
