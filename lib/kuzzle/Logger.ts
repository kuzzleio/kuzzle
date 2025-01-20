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

import { pino, Logger as PinoLogger } from "pino";
import { KuzzleError } from "../kerror/errors";

/**
 * The Logger class provides logging functionality for Kuzzle.
 */
export class Logger {
  private pino: PinoLogger;
  private failsafeModeString: string;
  private warnedForSillyDeprecation = false;
  private warnedForVerboseDeprecation = false;

  constructor() {
    const config = global.app.config.content.server.logs;
    const deprecatedConfig =
      global.app.config.content.plugins["kuzzle-plugin-logger"];

    const transport = pino.transport({
      targets: [
        {
          options: {
            colorize: true,
          },
          target: "pino/file",
        },
        {
          pipeline: [
            {
              options: {
                additionalBindings: {
                  _kuzzle_info: {
                    author: -1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    updater: -1,
                  },
                },
              },
              target: "pino-transport-ecs",
            },
            {
              options: {
                esVersion: 7,
                flushBytes: 1000,
                index: "&platform.logs",
                node: "http://localhost:9200",
              },
              target: "pino-elasticsearch",
            },
          ],
        },
      ],
    });

    this.pino = pino(transport);

    this.failsafeModeString = global.kuzzle.config.plugins.common.failsafeMode
      ? "[FAILSAFE MODE] "
      : "";

    if (deprecatedConfig) {
      this.warn(
        "[DEPRECATED] The plugins.kuzzle-plugin-logger configuration is deprecated, use server.logs instead.",
      );
    }
  }

  /**
   * Logs a message with the "trace" level.
   *
   * @param message - The message to log.
   */
  trace(message: string) {
    this.pino.trace(this.formatMessage(message));
  }

  /**
   * Logs a message with the "debug" level.
   *
   * @param message - The message to log.
   */
  debug(message: string) {
    this.pino.debug(this.formatMessage(message));
  }

  /**
   * Logs a message with the "info" level.
   *
   * @param message - The message to log.
   */
  info(message: string) {
    this.pino.info(this.formatMessage(message));
  }

  /**
   * Logs a message with the "warn" level.
   *
   * @param message - The message to log.
   */
  warn(message: string) {
    this.pino.warn(this.formatMessage(message));
  }

  /**
   * Logs a message with the "error" level.
   *
   * @param message - The message to log.
   */
  error(message: string | KuzzleError) {
    if (message instanceof KuzzleError) {
      this.pino.error(this.formatMessage(message.message));
    } else {
      this.pino.error(this.formatMessage(message));
    }
  }

  /**
   * Logs a message with the "fatal" level.
   *
   * @param message - The message to log.
   */
  fatal(message: string) {
    this.pino.fatal(this.formatMessage(message));
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
      this.pino.warn(
        "[DEPRECATED] Logger.silly is deprecated, use Logger.trace instead. Logging messages at trace level.",
      );
    }
    this.pino.trace(this.formatMessage(message));
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
      this.pino.warn(
        "[DEPRECATED] Logger.verbose is deprecated, use Logger.debug instead. Logging messages at debug level.",
      );
    }
    this.pino.debug(this.formatMessage(message));
  }

  private formatMessage(message: string): string {
    const nodeIdString = global.kuzzle.id ? `[${global.kuzzle.id}] ` : "";
    let requestIdString = "";

    if (
      global.kuzzle.asyncStore?.exists() &&
      global.kuzzle.asyncStore?.has("REQUEST")
    ) {
      const request = global.kuzzle.asyncStore.get("REQUEST");

      requestIdString = `[${request.id}] `;
    }
    return `${nodeIdString}${this.failsafeModeString}${requestIdString}${message}`;
  }
}
