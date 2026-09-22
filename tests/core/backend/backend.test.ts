import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

describe("Backend", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
  });

  describe("#_instanceProxy", () => {
    it("returns the plugin definition and an init function", () => {
      internals(application)._pipes = "pipes";
      internals(application)._hooks = "hooks";
      internals(application)._controllers = "controllers";

      const instance = internals(application)._instanceProxy;

      expect(instance.init).toBeTypeOf("function");
      expect(instance.pipes).toBe("pipes");
      expect(instance.hooks).toBe("hooks");
      expect(instance.api).toBe("controllers");
    });
  });

  describe("#sdk", () => {
    it("returns the embedded sdk once started", async () => {
      await application.start();

      // Imported here rather than at the top of the file: `createBackend`
      // re-evaluates the module graph, so the class the application built is
      // the one on the *current* graph — a statically imported `EmbeddedSDK`
      // would be a different class object and the check would never pass.
      const { EmbeddedSDK } =
        await import("../../../lib/core/shared/sdk/embeddedSdk");

      expect(application.sdk).toBeInstanceOf(EmbeddedSDK);
    });

    it("throws if the application is not started", () => {
      expect(() => application.sdk).toThrow(
        expect.objectContaining({
          id: "plugin.runtime.unavailable_before_start",
        }),
      );
    });
  });

  describe("#nodeId", () => {
    it("names the node after the backend", async () => {
      await application.start();

      expect(internals(application).nodeId).toMatch(/^knode-/);
    });
  });

  describe("#start", () => {
    it("calls kuzzle.start with an instantiated plugin and the app's options", async () => {
      application.version = "42.21.84";
      internals(application)._vaultKey = "vaultKey";
      internals(application)._secretsFile = "secretsFile";
      internals(application)._installationsWaitingList = [
        { id: "foo", handler: () => {} },
      ];
      internals(application)._plugins = {};
      internals(application)._support = {
        mappings: "mappings",
        fixtures: "fixtures",
        securities: "securities",
      };
      internals(application)._import = {
        mappings: {
          index1: { collection1: { mappings: { fieldA: { type: "text" } } } },
        },
        onExistingUsers: "overwrite",
        profiles: { profileA: { policies: [{ roleId: "roleA" }] } },
        roles: { roleA: { controllers: { "*": { actions: { "*": true } } } } },
        userMappings: { properties: { fieldA: { type: "text" } } },
        user: { content: { profileIds: ["profileA"], name: "bar" } },
      };

      await application.start();

      expect(global.kuzzle.start).toHaveBeenCalledTimes(1);

      const [plugin, options] = (global.kuzzle.start as any).mock.calls[0];

      expect(plugin.application).toBe(true);
      expect(plugin.name).toBe("black-mesa");
      expect(plugin.version).toBe("42.21.84");
      // `_instanceProxy` is a getter that builds a fresh object, `init`
      // closure included, on every read — so the plugin's copy is never the
      // same object as a second read of it. What the assertion is about is
      // what the proxy carries.
      expect(plugin.instance.pipes).toBe(internals(application)._pipes);
      expect(plugin.instance.hooks).toBe(internals(application)._hooks);
      expect(plugin.instance.api).toBe(internals(application)._controllers);
      expect(plugin.instance.init).toBeTypeOf("function");

      expect(options.secretsFile).toBe("secretsFile");
      expect(options.vaultKey).toBe("vaultKey");
      expect(Object.keys(options.plugins)).toEqual([
        "kuzzle-plugin-auth-passport-local",
      ]);
      expect(options.installations).toBe(
        internals(application)._installationsWaitingList,
      );
      expect(options.import).toBe(internals(application)._import);
      expect(options.support).toBe(internals(application)._support);

      // ⚠️ The Mocha spec appended a pipe on `kuzzle:state:ready` asserting
      // `application.started` was already true inside it. Nothing ever ran it:
      // the pipes reach the event bus of the `Kuzzle` that `start()` builds,
      // and that object is the stub — its `start()` triggers nothing. The
      // assertion that survives is what `start()` itself does, and the pipe
      // list is handed on rather than executed.
      expect(plugin.instance.pipes["kuzzle:state:ready"]).toHaveLength(1);
      expect(internals(application).started).toBe(true);
    });

    it("only submits the configured embedded plugins", async () => {
      application.config.content.plugins.common.include = ["foo"];

      await expect(application.start()).rejects.toThrow(
        // Node's own message, and it changed with the runner: the Mocha suite
        // ran the emitted CommonJS ("Cannot find module"), vitest runs the
        // source as ESM.
        /Cannot find package 'foo'/,
      );

      application.config.content.plugins.common.include = [
        "kuzzle-plugin-auth-passport-local",
      ];

      await application.start();

      expect(global.kuzzle.start).toHaveBeenCalledTimes(1);

      const [, options] = (global.kuzzle.start as any).mock.calls[0];

      expect(Object.keys(options.plugins)).toEqual([
        "kuzzle-plugin-auth-passport-local",
      ]);
    });

    it("throws if the application is already started", async () => {
      await application.start();

      await expect(application.start()).rejects.toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#kerror", () => {
    it("exposes the error helpers", () => {
      expect(application.kerror.get).toBeTypeOf("function");
      expect(application.kerror.reject).toBeTypeOf("function");
      expect(application.kerror.getFrom).toBeTypeOf("function");
      expect(application.kerror.wrap).toBeTypeOf("function");
    });
  });

  describe("#trigger", () => {
    it("forwards to kuzzle.pipe and answers what it answers", async () => {
      await application.start();
      (global.kuzzle.pipe as any).mockResolvedValue("resonance cascade");

      const result = await application.trigger("xen:crystal", "payload");

      expect((global.kuzzle.pipe as any).mock.calls).toEqual([
        ["xen:crystal", "payload"],
      ]);
      expect(result).toBe("resonance cascade");
    });

    it("throws if the application is not started", () => {
      expect(() => application.trigger("xen:crystal", "payload")).toThrow(
        expect.objectContaining({
          id: "plugin.runtime.unavailable_before_start",
        }),
      );
    });
  });

  describe("#install", () => {
    it("stores id, handler and description in the waiting list", () => {
      const handler = vi.fn(async () => {});

      application.install("id", handler, "description");

      expect(internals(application)._installationsWaitingList).toEqual([
        { id: "id", handler, description: "description" },
      ]);
      expect(handler).not.toHaveBeenCalled();
    });

    it("throws if the app is already running", async () => {
      await application.start();

      expect(() =>
        application.install(
          "id",
          vi.fn(async () => {}),
        ),
      ).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });
});
