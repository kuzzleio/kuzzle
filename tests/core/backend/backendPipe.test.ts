import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import type { Kuzzle } from "../../../lib/kuzzle";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

describe("BackendPipe", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
  });

  describe("#register", () => {
    it("registers a new pipe, after the one that sets `started`", () => {
      const handler = async () => {};
      const handlerBis = async () => {};

      application.pipe.register("kuzzle:state:ready", handler);
      application.pipe.register("kuzzle:state:ready", handlerBis);

      const pipes = internals(application)._pipes["kuzzle:state:ready"];

      expect(pipes).toHaveLength(3);
      expect(pipes[1]).toBe(handler);
      expect(pipes[2]).toBe(handlerBis);
    });

    it("throws if the pipe handler is invalid", () => {
      expect(() =>
        application.pipe.register(
          "kuzzle:state:ready",
          {} as unknown as () => Promise<void>,
        ),
      ).toThrow(expect.objectContaining({ id: "plugin.assert.invalid_pipe" }));
    });

    it("throws if the application is already started without the dynamic option", () => {
      internals(application).started = true;

      expect(() =>
        application.pipe.register("kuzzle:state:ready", async () => {}),
      ).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });

    it("registers a pipe at runtime with the dynamic option", () => {
      const handler = async () => {};
      const registerPipe = vi.fn(() => "pipe-unique-id");
      const applicationPlugin = { name: "black-mesa" };

      internals(application).started = true;
      global.kuzzle = {
        pluginsManager: { application: applicationPlugin, registerPipe },
      } as unknown as Kuzzle;

      const pipeId = application.pipe.register("kuzzle:state:ready", handler, {
        dynamic: true,
      });

      expect(pipeId).toBe("pipe-unique-id");
      expect(registerPipe.mock.calls).toEqual([
        [applicationPlugin, "kuzzle:state:ready", handler],
      ]);
    });

    it("throws if the application is started but unknown to the plugins manager", () => {
      internals(application).started = true;
      global.kuzzle = {
        pluginsManager: { application: undefined, registerPipe: vi.fn() },
      } as unknown as Kuzzle;

      expect(() =>
        application.pipe.register("kuzzle:state:ready", async () => {}, {
          dynamic: true,
        }),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.runtime.unavailable_before_start",
        }),
      );
    });
  });

  describe("#unregister", () => {
    it("unregisters a dynamic pipe", () => {
      const unregisterPipe = vi.fn();

      internals(application).started = true;
      global.kuzzle = {
        pluginsManager: { unregisterPipe },
      } as unknown as Kuzzle;

      application.pipe.unregister("unique-pipe-id");

      expect(unregisterPipe.mock.calls).toEqual([["unique-pipe-id"]]);
    });

    it("throws if the application is not started", () => {
      internals(application).started = false;

      expect(() => application.pipe.unregister("unique-pipe-id")).toThrow(
        expect.objectContaining({
          id: "plugin.runtime.unavailable_before_start",
        }),
      );
    });
  });
});
