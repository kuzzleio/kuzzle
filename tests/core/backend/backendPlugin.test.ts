import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import type { Plugin } from "../../../lib/types";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

class DummyPlugin {
  init() {}
}

class FoobarPlugin {
  init() {}
}

const asPlugin = (instance: object) => instance as unknown as Plugin;

describe("BackendPlugin", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
  });

  describe("#use", () => {
    class WrongPlugin {}

    it("uses a plugin and infers its name from the class", () => {
      const plugin = asPlugin(new DummyPlugin());

      application.plugin.use(plugin);

      expect(internals(application)._plugins.dummy).toEqual({
        plugin,
        options: {},
      });
    });

    it("takes the plugin's name and options from the second argument", () => {
      const plugin = asPlugin(new DummyPlugin());

      application.plugin.use(plugin, {
        name: "not-dummy",
        manifest: { foo: "bar" },
      });

      expect(internals(application)._plugins["not-dummy"]).toEqual({
        plugin,
        options: { name: "not-dummy", manifest: { foo: "bar" } },
      });
    });

    it("throws if the plugin is a plain object with no name", () => {
      expect(() =>
        application.plugin.use(asPlugin({ init: () => {} })),
      ).toThrow(
        expect.objectContaining({ id: "plugin.assert.no_name_provided" }),
      );
    });

    it("throws if the given name is not a valid plugin name", () => {
      expect(() =>
        application.plugin.use(asPlugin(new DummyPlugin()), {
          name: "DummyPlugin",
        }),
      ).toThrow(
        expect.objectContaining({ id: "plugin.assert.invalid_plugin_name" }),
      );
    });

    it("throws if the name is already taken", () => {
      application.plugin.use(asPlugin(new DummyPlugin()));

      expect(() => application.plugin.use(asPlugin(new DummyPlugin()))).toThrow(
        expect.objectContaining({ id: "plugin.assert.name_already_exists" }),
      );
    });

    it("throws if the plugin has no init method", () => {
      expect(() => application.plugin.use(asPlugin(new WrongPlugin()))).toThrow(
        expect.objectContaining({ id: "plugin.assert.init_not_found" }),
      );
    });
  });

  describe("#get", () => {
    let dummyPlugin: Plugin;
    let foobarPlugin: Plugin;

    beforeEach(() => {
      dummyPlugin = asPlugin(new DummyPlugin());
      foobarPlugin = asPlugin(new FoobarPlugin());

      application.plugin.use(dummyPlugin);
      application.plugin.use(foobarPlugin);
    });

    it("returns the loaded plugin instance", () => {
      expect(application.plugin.get("dummy")).toBe(dummyPlugin);
    });

    it("throws if the plugin does not exist, suggesting the closest name", () => {
      // `didYouMean` returns "" unless `global.NODE_ENV` is "development", and
      // the unit suites run under NODE_ENV=test — so the suggestion half of
      // this message is only reachable with the global pinned.
      const nodeEnv = global.NODE_ENV;
      global.NODE_ENV = "development";

      try {
        expect(() => application.plugin.get("foubar")).toThrow(
          expect.objectContaining({
            id: "plugin.assert.plugin_not_found",
            message: 'Plugin "foubar" not found. Did you mean "foobar"?',
          }),
        );
      } finally {
        global.NODE_ENV = nodeEnv;
      }
    });
  });

  describe("#list", () => {
    it("lists the loaded plugins", () => {
      application.plugin.use(asPlugin(new DummyPlugin()));
      application.plugin.use(asPlugin(new FoobarPlugin()));

      expect(application.plugin.list()).toEqual(["dummy", "foobar"]);
    });
  });
});
