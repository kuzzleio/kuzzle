import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

describe("BackendHook", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
  });

  describe("#register", () => {
    it("registers a new hook", () => {
      const handler = async () => {};
      const handlerBis = async () => {};

      application.hook.register("kuzzle:state:ready", handler);
      application.hook.register("kuzzle:state:ready", handlerBis);

      expect(internals(application)._hooks["kuzzle:state:ready"]).toEqual([
        handler,
        handlerBis,
      ]);
    });

    it("throws if the hook handler is invalid", () => {
      expect(() =>
        application.hook.register(
          "kuzzle:state:ready",
          {} as unknown as () => Promise<void>,
        ),
      ).toThrow(expect.objectContaining({ id: "plugin.assert.invalid_hook" }));
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() =>
        application.hook.register("kuzzle:state:ready", async () => {}),
      ).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });
});
