"use strict";

const should = require("should");
const mockrequire = require("mock-require");
const rewire = require("rewire");
const path = require("path");

const KuzzleMock = require("../../mocks/kuzzle.mock");
const FsMock = require("../../mocks/fs.mock");

const rootDir = path.resolve(`${require.main.filename}/../../../..`);

class TestPlugin {
  constructor() {}
  init() {}
}

class WrongPlugin {
  constructor() {}
}

describe("Plugin", () => {
  let kuzzle;
  let Plugin;
  let plugin;
  let instance;
  let fsMock;
  let manifest;
  let packageJson;

  beforeEach(() => {
    manifest = {
      name: "lambda-core",
      kuzzleVersion: ">=2.x",
    };

    packageJson = { version: "version" };

    fsMock = new FsMock();

    mockrequire("fs", fsMock);
    mockrequire("testPlugin", TestPlugin);
    mockrequire(`${rootDir}/testPlugin/manifest.json`, manifest);
    mockrequire("testPlugin/package.json", packageJson);

    mockrequire.reRequire("../../../lib/core/plugin/plugin");
    Plugin = rewire("../../../lib/core/plugin/plugin");

    kuzzle = new KuzzleMock();

    instance = {};

    plugin = new Plugin(instance);
  });

  describe("#constructor", () => {
    it("should instantiates the plugin and set the name if given", () => {
      const options = { name: "lambda-core", application: true };

      plugin = new Plugin(instance, options);

      should(plugin.name).be.eql("lambda-core");
      should(plugin._application).be.true();
    });
  });

  describe("#init", () => {
    it("should initializes the plugin with name, config and context", () => {
      kuzzle.config = {
        plugins: {
          "lambda-core": "configuration",
        },
      };

      plugin.init("lambda-core");

      should(plugin.name).be.eql("lambda-core");
      kuzzle.config.plugins["lambda-core"] = "config";
      should(plugin.config).be.eql("configuration");
      should(plugin._context.constructor.name).be.eql("PluginContext");
    });

    it("should initializes with privileged context", () => {
      kuzzle.config = {
        plugins: {
          "lambda-core": { privileged: true },
        },
      };
      plugin.manifest = { privileged: true };

      plugin.init("lambda-core");

      should(plugin._context.constructor.name).be.eql(
        "PrivilegedPluginContext"
      );
    });

    it("should throw an error if the manifest kuzzleVersion is not valid", () => {
      plugin = new Plugin({ _manifest: { kuzzleVersion: "42.21.0" } });

      should(() => {
        plugin.init("wrong-version");
      }).throwError({
        id: "plugin.manifest.version_mismatch",
      });
    });
  });

  describe("#info", () => {
    it("should returns application info", () => {
      const options = { name: "lambda-core", application: true };
      instance = {
        api: "api",
        hooks: {
          "document:beforeCreate": "handler",
          "document:afterCreate": "handler",
        },
        pipes: {
          "index:beforeCreate": "handler",
          "index:afterCreate": "handler",
        },
      };
      plugin = new Plugin(instance, options);
      plugin.version = "version";

      const info = plugin.info();

      should(info.name).be.eql("lambda-core");
      should(info.version).be.eql("version");
      should(info.controllers).be.eql("api");
      should(info.pipes).be.eql(["index:beforeCreate", "index:afterCreate"]);
      should(info.hooks).be.eql([
        "document:beforeCreate",
        "document:afterCreate",
      ]);
    });

    it("should returns plugin info", () => {
      const options = { name: "lambda-core" };
      instance = {
        controllers: {
          email: {
            send: () => {},
          },
        },
        routes: ["routes"],
        strategies: { ldap: "LDAP" },
        hooks: {
          "document:beforeCreate": "handler",
          "document:afterCreate": "handler",
        },
        pipes: {
          "index:beforeCreate": "handler",
          "index:afterCreate": "handler",
        },
      };
      plugin = new Plugin(instance, options);
      plugin.version = "version";
      plugin.manifest = "manifest";

      const info = plugin.info();

      should(info.controllers).be.eql(["lambda-core/email"]);
      should(info.hooks).be.eql([
        "document:beforeCreate",
        "document:afterCreate",
      ]);
      should(info.manifest).be.eql("manifest");
      should(info.pipes).be.eql(["index:beforeCreate", "index:afterCreate"]);
      should(info.routes).be.eql(["routes"]);
      should(info.strategies).be.eql(["ldap"]);
      should(info.version).be.eql("version");
    });
  });

  describe("Plugin.loadFromDirectory", () => {
    beforeEach(() => {
      fsMock.statSync.returns({ isDirectory: () => true });
    });

    it("should instantiates plugin class from disk and wrap it in Kuzzle Plugin", () => {
      fsMock.existsSync.returns(true);

      const loadedPlugin = Plugin.loadFromDirectory("testPlugin");

      should(loadedPlugin.manifest.raw).be.eql(manifest);
      should(fsMock.existsSync).be.calledWith("testPlugin/package.json");
      should(loadedPlugin.version).be.eql(packageJson.version);
    });

    it("should throws an error if the path is not a directory", () => {
      fsMock.statSync.returns({ isDirectory: () => false });

      should(() => {
        Plugin.loadFromDirectory(kuzzle, "./plugins/enabled");
      }).throwError({ id: "plugin.assert.cannot_load" });
    });

    it("should properly load customs errors from manifest.json", () => {
      const errors = require("../../../lib/kerror/codes");
      manifest.errors = {
        some_error: {
          description: "foo",
          code: 1,
          message: "Some error occured %s",
          class: "BadRequestError",
        },
        some_other_error: {
          description: "bar",
          code: 2,
          message: "Some other error occured %s",
          class: "ForbiddenError",
        },
      };

      plugin = Plugin.loadFromDirectory("testPlugin");

      should(kuzzle.log.info)
        .calledOnce()
        .calledWith("[lambda-core] Custom errors successfully loaded.");

      const pluginErrors = errors.domains.plugin.subDomains;

      should(pluginErrors).have.ownProperty(plugin.manifest.name);
      should(pluginErrors[plugin.manifest.name]).have.ownProperty("errors");
      should(pluginErrors[plugin.manifest.name].errors).be.deepEqual(
        manifest.errors
      );
    });

    it("should throw PluginImplementationError if customs errors from manifest.json are badly formatted", () => {
      manifest.errors = {
        some_error: {
          message: "Some error occured %s",
          class: "BadRequestError",
        },
        some_other_error: {
          code: 2,
          message: "Some other error occured %s",
          class: "ForbiddenError",
        },
      };

      should(() => {
        Plugin.loadFromDirectory("testPlugin");
      }).throwError({ id: "plugin.manifest.invalid_errors" });
    });

    it("should throw if a plugin does not contain a manifest.json file", () => {
      mockrequire.stop(`${rootDir}/testPlugin/manifest.json`);

      should(() => {
        Plugin.loadFromDirectory("testPlugin");
      }).throwError({ id: "plugin.manifest.cannot_load" });
    });

    it("should throws an error if the plugin does not expose init function", () => {
      mockrequire("testPlugin", WrongPlugin);

      should(() => {
        Plugin.loadFromDirectory("testPlugin");
      }).throwError({ id: "plugin.assert.init_not_found" });
    });
  });
});
