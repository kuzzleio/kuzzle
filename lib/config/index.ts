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

import assert from "assert";
import { inspect } from "node:util";

import type { JSONObject } from "../types/JSONObject";

import rc from "rc";
import defaultConfig from "./default.config";
import type { IKuzzleConfiguration } from "../types/config/KuzzleConfiguration";
import packageJson from "../../package.json";
import { wrap } from "../kerror";
import { isPlainObject } from "../util/safeObject";
import bytes from "../util/bytes";

const wrapped = wrap("core", "configuration");

/**
 * Loads, interprets and checks configuration files.
 *
 * The return type is the **merged** shape, not the partial one a user writes:
 * `rc()` applies `.kuzzlerc` and the environment over the packaged defaults,
 * and the two sections the defaults do not carry — `version` and `internal` —
 * are assigned below. That is what makes every section present, and it is the
 * claim `global.kuzzle.config` is read against everywhere else (ADR-0001,
 * TD-53). Anything added to {@link IKuzzleConfiguration} has to be produced
 * here or in `default.config.ts`, or the two files stop agreeing.
 */
/**
 * The configuration as `rc` hands it over: every section is present because
 * `default.config.ts` provides it, but every *value* may have arrived from a
 * file or the environment as a string — which is what `unstringify()` below
 * exists for. The checks and preprocessors run against that, not against
 * {@link IKuzzleConfiguration}, which is what they produce.
 */
type RawConfig = JSONObject;

export function loadConfig(): IKuzzleConfiguration {
  let config: any;

  try {
    config = rc("kuzzle", defaultConfig);
  } catch (e) {
    throw wrapped.get(
      "cannot_parse",
      e instanceof Error ? e.message : inspect(e),
    );
  }

  config = unstringify(config);

  checkLimitsConfig(config);
  checkHttpOptions(config);
  checkWebSocketOptions(config);
  checkClusterOptions(config);

  config.internal = {
    hash: {
      seed: Buffer.from("^m&mOISKBvb1xpl1mRsrylaQXpjb&IJX"),
    },
  };

  preprocessHttpOptions(config);
  preprocessProtocolsOptions(config);
  preprocessRedisOptions(config.services.internalCache);
  preprocessRedisOptions(config.services.memoryStorage);

  // Injects the current Kuzzle version
  config.version = packageJson.version;

  return config;
}

/**
 * RC params can be overriden using environment variables,
 * in which case all values are passed as strings.
 *
 * When dealing with configuration, we can safely assume the expected
 * correct type
 *
 * @param {object} cfg - configuration loaded using RC
 * @returns {object} correctly typed configuration
 */
function unstringify(cfg: RawConfig): RawConfig {
  Object.keys(cfg)
    .filter(
      (k) =>
        !/version$/i.test(k) &&
        (typeof cfg[k] === "string" || cfg[k] instanceof Object),
    )
    .forEach((k) => {
      if (typeof cfg[k] === "string") {
        if (cfg[k] === "true") {
          cfg[k] = true;
        } else if (cfg[k] === "false") {
          cfg[k] = false;
        } else if (cfg[k].startsWith("*json:")) {
          try {
            cfg[k] = JSON.parse(cfg[k].replace(/^\*json:/, ""));
          } catch {
            throw wrapped.get(
              "cannot_parse",
              `the key "${k}" does not contain a valid stringified JSON (${cfg[k]})`,
            );
          }
        } else if (/^(-|\+)?([0-9]+)$/.test(cfg[k])) {
          cfg[k] = Number.parseInt(cfg[k]);
        } else if (/^(-|\+)?([0-9]+(\.[0-9]+)?)$/.test(cfg[k])) {
          cfg[k] = parseFloat(cfg[k]);
        }
      } else {
        cfg[k] = unstringify(cfg[k]);
      }
    });

  return cfg;
}

/**
 * Checks the "limits" section of the provided configuration object.
 * Throw warnings if invalid configuration are detected and auto-correct
 * them if necessary
 *
 * @param {object} cfg
 */
function checkLimitsConfig(cfg: RawConfig): void {
  const limits = [
    "concurrentRequests",
    "documentsFetchCount",
    "documentsWriteCount",
    "loginsPerSecond",
    "requestsBufferSize",
    "requestsBufferWarningThreshold",
    "subscriptionConditionsCount",
    "subscriptionMinterms",
    "subscriptionRooms",
    "subscriptionDocumentTTL",
  ];
  const canBeZero = [
    "subscriptionMinterms",
    "subscriptionRooms",
    "subscriptionDocumentTTL",
  ];

  const configured = cfg.limits;

  if (!isPlainObject(configured)) {
    throw wrapped.get("invalid_type", "limits", "object");
  }

  // One read per limit, validated where it is read: `isPlainObject` narrows
  // to a record of `unknown`, which is the honest type for a configuration
  // file, and the three comparisons below each re-read two of these.
  const limit = (opt: string): number => {
    const value = configured[opt];

    if (typeof value !== "number") {
      throw wrapped.get("invalid_type", `limits.${opt}`, "number");
    }

    return value;
  };

  for (const opt of limits) {
    const value = limit(opt);

    if (value < 0 || (value === 0 && !canBeZero.includes(opt))) {
      const allowed = `>= ${canBeZero.includes(opt) ? "0" : "1"}`;
      throw wrapped.get("out_of_range", `limits.${opt}`, allowed);
    }
  }

  if (limit("concurrentRequests") >= limit("requestsBufferSize")) {
    throw wrapped.get(
      "out_of_range",
      "limits.concurrentRequests",
      'lower than "limits.requestsBufferSize"',
    );
  }

  if (
    limit("requestsBufferWarningThreshold") < limit("concurrentRequests") ||
    limit("requestsBufferWarningThreshold") > limit("requestsBufferSize")
  ) {
    throw wrapped.get(
      "out_of_range",
      "limits.requestsBufferWarningThreshold",
      "[limits.concurrentRequests, limits.requestsBufferSize]",
    );
  }
}

function checkWebSocketOptions(config: RawConfig): void {
  const cfg = config.server.protocols.websocket;

  if (cfg === undefined) {
    return;
  }

  assert(
    typeof cfg.enabled === "boolean",
    `[websocket] "enabled" parameter: invalid value "${cfg.enabled}" (boolean expected)`,
  );
  // The 1000 ms floor is the protocol's, not this check's: `httpwsProtocol`
  // replaces a lower value (0 included) with its default, and warns.
  assert(
    Number.isInteger(cfg.idleTimeout) && cfg.idleTimeout >= 0,
    `[websocket] "idleTimeout" parameter: invalid value "${cfg.idleTimeout}" (integer >= 0 expected)`,
  );
  assert(
    Number.isInteger(cfg.rateLimit) && cfg.rateLimit >= 0,
    `[websocket] "rateLimit" parameter: invalid value "${cfg.rateLimit}" (integer >= 0 expected)`,
  );
  assert(
    typeof cfg.compression === "boolean",
    `[websocket] "compression" parameter: invalid value "${cfg.compression}" (boolean expected)`,
  );
  assert(
    typeof cfg.sendPingsAutomatically === "boolean",
    `[websocket] "sendPingsAutomatically" parameter: invalid value "${cfg.sendPingsAutomatically}" (boolean expected)`,
  );
  assert(
    typeof cfg.resetIdleTimeoutOnSend === "boolean",
    `[websocket] "resetIdleTimeoutOnSend" parameter: invalid value "${cfg.resetIdleTimeoutOnSend}" (boolean expected)`,
  );
}

function checkHttpOptions(config: RawConfig): void {
  const cfg = config.server.protocols.http;

  if (cfg === undefined) {
    return;
  }

  assert(
    typeof config.http.accessControlAllowOrigin === "string" ||
      Array.isArray(config.http.accessControlAllowOrigin),
    `[http] "accessControlAllowOrigin" parameter: invalid value "${config.http.accessControlAllowOrigin}" (array or string expected)`,
  );
  assert(
    typeof config.http.accessControlAllowOriginUseRegExp === "boolean",
    `[http] "accessControlAllowOriginUseRegExp" parameter: invalid value "${config.http.accessControlAllowOriginUseRegExp}" (boolean expected)`,
  );
  assert(
    typeof cfg.enabled === "boolean",
    `[http] "enabled" parameter: invalid value "${cfg.enabled}" (boolean expected)`,
  );
  assert(
    typeof cfg.allowCompression === "boolean",
    `[http] "allowCompression" parameter: invalid value "${cfg.allowCompression}" (boolean expected)`,
  );
  assert(
    Number.isInteger(cfg.maxEncodingLayers) && cfg.maxEncodingLayers >= 1,
    `[http] "maxEncodingLayers" parameter: invalid value "${cfg.maxEncodingLayers}" (integer >= 1 expected)`,
  );

  const maxFormFileSize = bytes(cfg.maxFormFileSize);
  assert(
    maxFormFileSize !== null &&
      Number.isInteger(maxFormFileSize) &&
      maxFormFileSize >= 0,
    `[http] "maxFormFileSize" parameter: cannot parse "${cfg.maxFormFileSize}"`,
  );
  cfg.maxFormFileSize = maxFormFileSize;

  assert(
    typeof config.http.cookieAuthentication === "boolean",
    `[http] "cookieAuthentication" parameter: invalid value "${config.http.cookieAuthentication}" (boolean expected)`,
  );
  assert(
    Array.isArray(cfg.additionalContentTypes) &&
      cfg.additionalContentTypes.every((ct: unknown) => typeof ct === "string"),
    `[http] "additionalContentTypes" parameter: invalid value "${cfg.additionalContentTypes}" (array of strings expected)`,
  );
}

function checkClusterOptions(config: RawConfig): void {
  const cfg = config.cluster;

  for (const prop of [
    "heartbeat",
    "joinTimeout",
    "minimumNodes",
    "activityDepth",
    "syncTimeout",
  ]) {
    assert(
      typeof cfg[prop] === "number" && cfg[prop] > 0,
      `[CONFIG] kuzzlerc.cluster.${prop}: value must be a number greater than 0`,
    );
  }

  assert(
    cfg.syncTimeout < cfg.joinTimeout,
    "[CONFIG] kuzzlerc.cluster.syncTimeout: value must be lower than kuzzlerc.cluster.joinTimeout",
  );

  for (const prop of ["command", "sync"]) {
    assert(
      typeof cfg.ports[prop] === "number" && cfg.ports[prop] > 0,
      `[CONFIG] kuzzlerc.cluster.ports.${prop}: value must be a number greater than 0`,
    );
  }

  for (const prop of ["messages", "bytes"]) {
    assert(
      Number.isInteger(cfg.retransmitBuffer?.[prop]) &&
        cfg.retransmitBuffer[prop] >= 0,
      `[CONFIG] kuzzlerc.cluster.retransmitBuffer.${prop}: integer >= 0 expected`,
    );
  }

  assert(
    typeof cfg.ipv6 === "boolean",
    "[CONFIG] kuzzlerc.cluster.ipv6: boolean expected",
  );
  // If config is passed with env variable, ip cannot be the value null
  // but only blank string or the string "null"
  if (`${cfg.ip}`.length === 0 || cfg.ip === "null") {
    cfg.ip = null;
  }
  assert(
    !cfg.ip || ["private", "public"].includes(cfg.ip),
    "[CONFIG] kuzzlerc.cluster.ip: invalid value (accepted values: public, private)",
  );

  assert(
    !cfg.interface || typeof cfg.interface === "string",
    "[CONFIG] kuzzlerc.cluster.interface: value must be either null, or a string",
  );
}

function preprocessHttpOptions(config: RawConfig): void {
  const httpConfig = config.http;

  if (httpConfig === undefined) {
    return;
  }

  if (typeof httpConfig.accessControlAllowOrigin === "string") {
    httpConfig.accessControlAllowOrigin = httpConfig.accessControlAllowOrigin
      .split(",")
      .map((value: string) => value.trim());
  }

  // Stored to avoid doing includes multiple times later
  config.internal.allowAllOrigins =
    httpConfig.accessControlAllowOrigin.includes("*");

  // If Regular Expression is enabled for accessControlAllowOrigin header we convert every string to a RegExp
  if (httpConfig.accessControlAllowOriginUseRegExp) {
    httpConfig.accessControlAllowOrigin =
      httpConfig.accessControlAllowOrigin.map(
        (pattern: string) => new RegExp(pattern),
      );
  }
}

function preprocessProtocolsOptions(config: RawConfig): void {
  const protocols: any = config.server.protocols;

  config.internal.notifiableProtocols = [];

  for (const [protocolName, protocolConfig] of Object.entries(protocols) as [
    string,
    any,
  ][]) {
    if (protocolConfig.enabled && protocolConfig.realtimeNotifications) {
      config.internal.notifiableProtocols.push(protocolName);
    }
  }
}

function preprocessRedisOptions(redisConfig: RawConfig): void {
  // @deprecated Remove those lines for Kuzzle v3 then
  // remove also 'database' from .kuzzlerc.sample.jsonc and default.config
  if (redisConfig.database) {
    redisConfig.options = { db: redisConfig.database, ...redisConfig.options };
  }
}
