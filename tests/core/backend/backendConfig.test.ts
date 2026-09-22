import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

/**
 * ⚠️ The Mocha spec drove this on `server.http.enabled`, which is not a
 * configuration key: the server's HTTP settings live under
 * `server.protocols.http`. `_.set` creates whatever path it is handed, so the
 * test set a branch nothing reads and then read it back — it demonstrated
 * lodash, not the subject. `tsc` is what said so. Driven here on the real key.
 */
describe("BackendConfig", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
  });

  describe("#set", () => {
    it("sets a configuration value", () => {
      application.config.set("server.protocols.http.enabled", false);

      expect(application.config.content.server.protocols.http.enabled).toBe(
        false,
      );
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() =>
        application.config.set("server.protocols.http.enabled", false),
      ).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#merge", () => {
    it("merges configuration values", () => {
      application.config.merge({
        server: { protocols: { http: { enabled: false } } },
      });

      expect(application.config.content.server.protocols.http.enabled).toBe(
        false,
      );
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() =>
        application.config.merge({
          server: { protocols: { http: { enabled: false } } },
        }),
      ).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });
});
