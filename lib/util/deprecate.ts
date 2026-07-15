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

import "../types/Global";

interface DeprecationLogger {
  warn: (...args: unknown[]) => void;
}

type Deprecations = Record<string, string | { message?: string } | null>;

const deprecationWarning = (
  logger: DeprecationLogger,
  ...args: unknown[]
): void => {
  if (global.NODE_ENV === "development") {
    logger.warn("DEPRECATION WARNING");
    logger.warn(...args);
  }
};

const warnIfDeprecated = (
  logger: DeprecationLogger,
  deprecations: Deprecations,
  member: PropertyKey,
): void => {
  const deprecatedProperty = Object.keys(deprecations).find(
    (deprecated) => deprecated === member,
  );

  if (!deprecatedProperty) {
    return;
  }

  const alternative = deprecations[deprecatedProperty];

  if (
    alternative &&
    typeof alternative === "object" &&
    typeof alternative.message === "string"
  ) {
    deprecationWarning(logger, alternative.message);
  } else if (typeof alternative === "string") {
    deprecationWarning(
      logger,
      `Use of '${deprecatedProperty}' property is deprecated. Please, use '${alternative}' instead.`,
    );
  } else {
    deprecationWarning(
      logger,
      `Use of '${deprecatedProperty}' property is deprecated.`,
    );
  }
};

export const deprecateProperties = <T extends object>(
  logger: DeprecationLogger,
  target: T,
  deprecations: Deprecations = {},
): T => {
  if (global.NODE_ENV !== "development") {
    return target;
  }

  return new Proxy(target, {
    get(object, key, ...rest) {
      if (key === "__isProxy") {
        return true;
      }

      warnIfDeprecated(logger, deprecations, key);

      return Reflect.get(object, key, ...rest);
    },

    set(object, key, ...rest) {
      warnIfDeprecated(logger, deprecations, key);

      return Reflect.set(object, key, ...rest);
    },
  });
};
