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

import defaultConfig from "../../config/default.config";
import type { SecurityConfiguration } from "../../types/config/SecurityConfiguration";

type AuthTokenSettings = SecurityConfiguration["authToken"];

/**
 * The settings for which a value set under the deprecated `security.jwt`
 * wins over one set under `security.authToken`: `gracePeriod` used to be
 * read from `jwt` only, so a configuration setting both keeps working as it
 * did. To drop in v3 (docs/v3-breaking-changes.md).
 */
export const LEGACY_FIRST: ReadonlySet<string> = new Set(["gracePeriod"]);

function isSet<V>(value: V | null | undefined): value is V {
  return value !== undefined && value !== null;
}

/**
 * Reads one authentication token setting: the value set under
 * `security.authToken` wins, then the one set under its deprecated spelling
 * `security.jwt`, then the packaged default (except for {@link LEGACY_FIRST}).
 *
 * `loadConfig()` already resolves both sections from what the configuration
 * files and the environment set. This covers a change made afterwards, e.g.
 * `app.config.set("security.jwt.expiresIn", "2h")` before `app.start()`: a
 * value that differs from the packaged default is one somebody set.
 */
export function authTokenSetting<K extends keyof AuthTokenSettings>(
  key: K,
): AuthTokenSettings[K] {
  const { authToken, jwt } = global.kuzzle.config.security; // NOSONAR: the deprecated section is read on purpose, as the documented fallback
  const packaged: AuthTokenSettings[K] = defaultConfig.security.authToken[key];
  const current: AuthTokenSettings[K] | undefined = authToken?.[key];
  const legacy: AuthTokenSettings[K] | undefined = jwt?.[key]; // NOSONAR
  const candidates = LEGACY_FIRST.has(key)
    ? [legacy, current]
    : [current, legacy];

  return (
    candidates.find((value) => isSet(value) && value !== packaged) ??
    candidates.find(isSet) ??
    packaged
  );
}
