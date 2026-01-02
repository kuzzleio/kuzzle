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
import { JSONObject } from "kuzzle-sdk";

import { KuzzleConfiguration, KuzzleRequest } from "../../index";

/**
 * The Logger class provides logging functionality for Kuzzle.
 */
export class Logger extends KuzzleLogger {
  /**
   * Shared pino instance to avoid spawning a transport worker for every
   * Logger instance (pino.transport adds a process "exit" listener).
   */
  private static basePino: any;

  private warnedForSillyDeprecation = false;
  private warnedForVerboseDeprecation = false;

  constructor(kuzzleConfig: KuzzleConfiguration, namespace: string = "kuzzle") {
    const config = kuzzleConfig.server.appLogs;
    const deprecatedConfig = kuzzleConfig.plugins["kuzzle-plugin-logger"];

    const getMergingObject = () => {
      const mergingObject: JSONObject = {};

      mergingObject.namespace = namespace;

      mergingObject.failsafeMode = Boolean(
        kuzzleConfig.plugins.common.failsafeMode,
      );

      if (global.nodeId) {
        mergingObject.nodeId = global.nodeId;
      }

      if (namespace !== "kuzzle") {
        return mergingObject;
      }

      if (
        global.kuzzle.asyncStore?.exists() &&
        global.kuzzle.asyncStore?.has("REQUEST")
      ) {
        const request = global.kuzzle.asyncStore.get(
          "REQUEST",
        ) as KuzzleRequest;

        mergingObject.requestId = request.id;
      }

      return mergingObject;
    };

    const hasSharedPino = Logger.basePino !== undefined;

    let loggerConfig: any;

    if (hasSharedPino) {
      loggerConfig = { getMergingObject, skipPinoInstance: true };
    } else if (deprecatedConfig?.services) {
      loggerConfig = {
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
      };
    } else {
      loggerConfig = {
        ...config,
        getMergingObject,
      };
    }

    super(loggerConfig);

    if (hasSharedPino) {
      // Reuse the shared pino instance to avoid stacking process exit listeners
      // added by pino.transport when spawning its worker thread.
      this.pino = Logger.basePino.child({});
    } else {
      Logger.basePino = this.pino;
    }

    if (deprecatedConfig) {
      this.warn(
        "[DEPRECATED] The plugins.kuzzle-plugin-logger configuration is deprecated, use server.logs instead.",
      );
    }
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

  child(namespace: string): Logger {
    // TODO, this is fishy we will probably need to properly remove the "as Logger"
    return super.child(namespace) as Logger;
  }
}
