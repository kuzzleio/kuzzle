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

import type { JSONObject } from "../types/JSONObject";
import { isPlainObject } from "./safeObject";

/**
 * Masks configuration secrets before the configuration leaves the process
 * (`server:getConfig`, `admin:dump`). The rule is driven by key names, not by
 * a list of paths, so that plugin and application secrets are covered too
 * (ADR-0004, Decision §3 and §4).
 */

/** What a secret value is replaced with. */
export const REDACTED = "***";

const SECRET_NAMES = new Set(["key", "pfx", "auth"]);

const SECRET_SUFFIXES = [
  "password",
  "passphrase",
  "secret",
  "apikey",
  "token",
  "credentials",
  "privatekey",
  "secretkey",
  "signingkey",
  "encryptionkey",
  "vault_key",
];

/**
 * `user:pass@` in a URL. The password part stops at the characters a URL
 * cannot hold unencoded there, so the match stays linear.
 */
const URL_CREDENTIALS = /(\/\/[^\s/:@]*):[^\s/@]+@/g;

/**
 * Whether a key names a secret, case-insensitively: exactly `key`, `pfx` or
 * `auth`, or a name ending with one of {@link SECRET_SUFFIXES}.
 * `cookieAuthentication` does not match by construction.
 */
export function isSecretKey(name: string): boolean {
  const lower = name.toLowerCase();

  return (
    SECRET_NAMES.has(lower) ||
    SECRET_SUFFIXES.some((suffix) => lower.endsWith(suffix))
  );
}

/** Replaces the password of every `scheme://user:pass@host` in a string. */
export function redactUrlCredentials(text: string): string {
  return text.replace(URL_CREDENTIALS, `$1:${REDACTED}@`);
}

/**
 * The value under a secret key. `null`, `undefined` and booleans are kept, so
 * one can still tell whether a secret is set; a plain object keeps its
 * structure with its leaves masked; anything else — string, number, `Buffer`,
 * array — is masked whole.
 */
function maskSecret(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === "boolean") {
    return value;
  }

  if (isPlainObject(value)) {
    const masked: JSONObject = {};

    for (const [key, child] of Object.entries(value)) {
      masked[key] = maskSecret(child);
    }

    return masked;
  }

  return REDACTED;
}

/**
 * A copy of `value` with every secret masked: values under a secret key (see
 * {@link isSecretKey}) become `"***"`, and URL credentials in every string
 * become `user:***@`. `mappings` subtrees are kept as-is: they describe
 * Elasticsearch fields, a field named `token` is not a secret.
 *
 * The input is never mutated. Plain objects and arrays are copied; any other
 * object (`Buffer`, `Date`...) is passed through, so this must run **before**
 * any JSON clone — a JSON clone turns a `Buffer` into `{ type, data }`, whose
 * leaves would no longer be recognised as one secret.
 */
export function redactSecrets<T>(value: T): T {
  return redact(value) as T;
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return redactUrlCredentials(value);
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const copy: JSONObject = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === "mappings") {
      copy[key] = child;
    } else if (isSecretKey(key)) {
      copy[key] = maskSecret(child);
    } else {
      copy[key] = redact(child);
    }
  }

  return copy;
}

/**
 * The configuration as it may leave the process: without `http.routes`
 * (already returned by `server:info`), `security` (salt, hash algorithm,
 * default rights, token secret) and `VAULT_KEY`, then with every remaining
 * secret masked. `server:getConfig` and `admin:dump` both use it, so they
 * cannot drift apart.
 */
export function toPublicConfig(config: JSONObject): JSONObject {
  const exported: JSONObject = { ...config };

  delete exported.security;
  delete exported.VAULT_KEY;

  if (isPlainObject(exported.http)) {
    exported.http = { ...exported.http };
    delete exported.http.routes;
  }

  return redactSecrets(exported);
}
