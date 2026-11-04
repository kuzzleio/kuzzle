/* The functional suite skips the scenarios needing a storage capability the
 * driver under test does not declare (cucumber.config.cjs, ADR-0003 step 04). */

import { createRequire } from "node:module";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { STORAGE_CAPABILITIES } from "../../../../lib/types/storage/StorageDriver";

const configPath = path.resolve(__dirname, "../../../../cucumber.config.cjs");
const load = createRequire(__filename);

type Profiles = Record<string, { tags?: string }>;

function profiles(capabilities?: string): Profiles {
  if (capabilities === undefined) {
    vi.stubEnv("KUZZLE_STORAGE_CAPABILITIES", undefined);
  } else {
    vi.stubEnv("KUZZLE_STORAGE_CAPABILITIES", capabilities);
  }

  Reflect.deleteProperty(load.cache, configPath);

  return load(configPath);
}

describe("cucumber.config.cjs capability tags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(load.cache, configPath);
  });

  it("runs every scenario on the built-in drivers", () => {
    const { http, websocket, mqttLegacy } = profiles();

    expect(http?.tags).toBe("not @realtime");
    expect(websocket?.tags).toBe("not @http");
    expect(mqttLegacy?.tags).toBe("not @http");
  });

  it("skips the scenarios of every capability a driver does not declare", () => {
    const { websocket } = profiles("");

    expect(websocket?.tags).toBe(
      [
        "not @http",
        ...STORAGE_CAPABILITIES.map((name) => `not @capability-${name}`),
      ].join(" and "),
    );
  });

  it("runs the scenarios of the capabilities a driver declares", () => {
    const { http } = profiles("stats, updateByQuery");

    expect(http?.tags).toBe(
      "not @realtime and not @capability-aggregations and not @capability-mappingUpdates",
    );
  });
});
