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

import { KuzzleLogger } from "kuzzle-logger";
import { JSONObject } from "../../";

/**
 * The Logger class provides logging functionality for Kuzzle.
 */
export class Logger extends KuzzleLogger {
  private warnedForSillyDeprecation = false;
  private warnedForVerboseDeprecation = false;

  constructor() {
    const config = global.app.config.content.server.appLogs;
    const deprecatedConfig =
      global.app.config.content.plugins["kuzzle-plugin-logger"];

    const getMergingObject = () => {
      const mergingObject: JSONObject = {};

      mergingObject.failsafeMode = Boolean(
        global.kuzzle.config.plugins.common.failsafeMode,
      );

      if (global.kuzzle.id) {
        mergingObject.nodeId = global.kuzzle.id;
      }

      if (
        global.kuzzle.asyncStore?.exists() &&
        global.kuzzle.asyncStore?.has("REQUEST")
      ) {
        const request = global.kuzzle.asyncStore.get("REQUEST");
        mergingObject.requestId = request.id;
      }

      return mergingObject;
    };

    super(
      deprecatedConfig?.services
        ? {
            getMergingObject,
            serviceName: "kuzzle",
            transport: {
              targets: Object.entries(deprecatedConfig.services).map(
                ([serviceName, serviceConfig]) => {
                  if (serviceName === "stdout") {
                    let level = serviceConfig.level || "info";

                    if (level === "silly") {
                      level = "trace";
                    }

                    if (level === "verbose") {
                      level = "debug";
                    }

                    return {
                      level,
                      preset: "stdout",
                    };
                  }
                },
              ),
            },
          }
        : {
            ...config,
            getMergingObject,
          },
    );

    if (deprecatedConfig) {
      this.warn(
        "[DEPRECATED] The plugins.kuzzle-plugin-logger configuration is deprecated, use server.logs instead.",
      );
    }

    global.kuzzle.onPipe("kuzzle:shutdown", async () => {
      await this.flush();
    });
  }

  /**
   * Logs a message with the "silly" level.
   *
   * @deprecated Use Logger.trace instead.
   * @param message - The message to log.
   */
  silly(message: string) {
    if (!this.warnedForSillyDeprecation) {
      this.warnedForSillyDeprecation = true;
      this.warn(
        "[DEPRECATED] Logger.silly is deprecated, use Logger.trace instead. Logging messages at trace level.",
      );
    }
    this.trace(message);
  }

  /**
   * Logs a message with the "verbose" level.
   *
   * @deprecated Use Logger.debug instead.
   * @param message - The message to log.
   */
  verbose(message: string) {
    if (!this.warnedForVerboseDeprecation) {
      this.warnedForVerboseDeprecation = true;
      this.warn(
        "[DEPRECATED] Logger.verbose is deprecated, use Logger.debug instead. Logging messages at debug level.",
      );
    }
    this.debug(message);
  }

  getLevel(): string {
    return this.level;
  }

  setLevel(level: string) {
    this.level = level;
  }
}
