"use strict";

const should = require("should");
const mockrequire = require("mock-require");

class DummyPlugin {
  constructor() {}
  init() {}
}

class FoobarPlugin {
  constructor() {}
  init() {}
}

describe("BackendPlugin", () => {
  let application;
  let Backend;

  beforeEach(() => {
    ({ Backend } = mockrequire.reRequire("../../../lib/core/backend/backend"));

    application = new Backend("black-mesa");
  });

  describe("#use", () => {
    class WrongPlugin {
      constructor() {}
    }

    it("should allow to use a plugin and infer the name", () => {
      const plugin = new DummyPlugin();

      application.plugin.use(plugin);

      should(application._plugins).has.property("dummy");
      should(application._plugins.dummy).be.eql({ plugin, options: {} });
    });

    it("should allow to specify the plugin's name and options", () => {
      const plugin = new DummyPlugin();

      application.plugin.use(plugin, {
        name: "not-dummy",
        manifest: "manifest",
      });

      should(application._plugins["not-dummy"]).be.eql({
        plugin,
        options: { name: "not-dummy", manifest: "manifest" },
      });
    });

    it("should throw an error if the plugin is invalid", () => {
      should(() => {
        application.plugin.use({ init: () => {} });
      }).throwError({ id: "plugin.assert.no_name_provided" });

      should(() => {
        application.plugin.use(new DummyPlugin(), { name: "DummyPlugin" });
      }).throwError({ id: "plugin.assert.invalid_plugin_name" });

      should(() => {
        application.plugin.use(new DummyPlugin());
        application.plugin.use(new DummyPlugin());
      }).throwError({ id: "plugin.assert.name_already_exists" });

      should(() => {
        application.plugin.use(new WrongPlugin());
      }).throwError({ id: "plugin.assert.init_not_found" });
    });
  });

  describe("#get", () => {
    let dummyPlugin;
    let foobarPlugin;

    beforeEach(() => {
      dummyPlugin = new DummyPlugin();
      foobarPlugin = new FoobarPlugin();

      application.plugin.use(dummyPlugin);
      application.plugin.use(foobarPlugin);
    });

    it("should return the loaded plugin instance", () => {
      const plugin = application.plugin.get("dummy");

      should(plugin).be.eql(dummyPlugin);
    });

    it("should throw an error if the plugin does not exists", () => {
      const nodeEnv = global.NODE_ENV;
      global.NODE_ENV = "development";

      should(() => {
        application.plugin.get("foubar");
      }).throwError({
        id: "plugin.assert.plugin_not_found",
        message: 'Plugin "foubar" not found. Did you mean "foobar"?',
      });

      global.NODE_ENV = nodeEnv;
    });
  });

  describe("#list", () => {
    let dummyPlugin;
    let foobarPlugin;

    beforeEach(() => {
      dummyPlugin = new DummyPlugin();
      foobarPlugin = new FoobarPlugin();

      application.plugin.use(dummyPlugin);
      application.plugin.use(foobarPlugin);
    });

    it("should list loaded plugins", () => {
      should(application.plugin.list()).be.eql(["dummy", "foobar"]);
    });
  });
});
