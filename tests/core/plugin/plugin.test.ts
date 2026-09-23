import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Plugin from "../../../lib/core/plugin/plugin";
import { PluginContext } from "../../../lib/core/plugin/pluginContext";
import PrivilegedPluginContext from "../../../lib/core/plugin/privilegedContext";
import * as errorCodes from "../../../lib/kerror/codes";
import type { PluginInstance } from "../../../lib/types/PluginInstance";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

/**
 * ⚠️ `loadFromDirectory` loads a plugin **from disk**: it `require`s the
 * directory, its `manifest.json` and its `package.json`, all at paths known
 * only at runtime. The Mocha spec replaced `fs` and those three module ids
 * with `mock-require`, which meant the one thing the method does — reading a
 * real plugin off a real filesystem — was the one thing not exercised.
 *
 * `vi.mock` cannot substitute a runtime `require` by path anyway, and it does
 * not have to: the fixtures below are actual directories, so the subject runs
 * unmodified and the assertions are about what it loaded.
 */
const fixture = (name: string) =>
  path.resolve(__dirname, "../../fixtures/plugins", name);

describe("#core/plugin/Plugin", () => {
  let config: Record<string, any>;
  let logger: ReturnType<typeof stubLogger>;

  beforeEach(() => {
    config = { plugins: {}, version: "2.56.0" };
    logger = stubLogger();

    /* `PluginContext`'s constructor binds a method off each of these, so a
     * spec that watches `init()` build one has to carry them. */
    stubKuzzle({
      config,
      log: logger,
      pluginsManager: {
        registerStrategy: vi.fn(),
        unregisterStrategy: vi.fn(),
      },
      validation: { addType: vi.fn(), validate: vi.fn() },
      vault: { secrets: {} },
    });
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  /** The bare minimum a plugin instance is: something with an `init`. */
  const instanceOf = (overrides: Record<string, unknown> = {}) =>
    invalid<PluginInstance>({ init: () => {}, ...overrides });

  describe("#constructor", () => {
    it("should take the name from its options", () => {
      const plugin = new Plugin(instanceOf(), {
        application: true,
        name: "lambda-core",
      });

      expect(plugin.name).toBe("lambda-core");
      expect(plugin.application).toBe(true);
    });

    it("should default to an unnamed, non-application plugin", () => {
      const plugin = new Plugin(instanceOf());

      expect(plugin.name).toBe("");
      expect(plugin.application).toBe(false);
    });

    /* A name that is not kebab-case is deprecated, not refused — and the
     * warning is the only notice a plugin author gets. */
    it("should warn about a name that is not kebab-case", () => {
      const plugin = new Plugin(instanceOf(), { name: "LambdaCore" });

      expect(plugin.name).toBe("LambdaCore");

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Plugin names should be in kebab-case"),
      );
    });

    it("should stay silent when the deprecation warning is turned off", () => {
      const plugin = new Plugin(instanceOf(), {
        deprecationWarning: false,
        name: "LambdaCore",
      });

      expect(plugin.name).toBe("LambdaCore");

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("#init", () => {
    it("should take its name, its configuration and a context", () => {
      config.plugins["lambda-core"] = { some: "configuration" };

      const plugin = new Plugin(instanceOf());

      plugin.init("lambda-core");

      expect(plugin.name).toBe("lambda-core");
      expect(plugin.config).toEqual({ some: "configuration" });
      expect(plugin.context).toBeInstanceOf(PluginContext);
    });

    /* The config is copied, not shared: a plugin that mutates its own config
     * must not reach into `kuzzle.config`. */
    it("should copy the configuration rather than alias it", () => {
      const configured = { some: "configuration" };

      config.plugins["lambda-core"] = configured;

      const plugin = new Plugin(instanceOf());

      plugin.init("lambda-core");
      plugin.config.some = "mutated";

      expect(configured.some).toBe("configuration");
    });

    it("should build a privileged context when both sides agree", () => {
      config.plugins["lambda-core"] = { privileged: true };

      const plugin = new Plugin(
        instanceOf({ _manifest: { privileged: true } }),
      );

      plugin.init("lambda-core");

      expect(plugin.context).toBeInstanceOf(PrivilegedPluginContext);
    });

    /* Privileged mode takes two acknowledgements — the plugin's manifest and
     * the operator's configuration — and the subject refuses each half alone.
     * Neither refusal was asserted. */
    it("should refuse privileged mode the manifest does not support", () => {
      config.plugins["lambda-core"] = { privileged: true };

      const plugin = new Plugin(instanceOf({ _manifest: {} }));

      expect(() => plugin.init("lambda-core")).toThrow(
        expect.objectContaining({
          id: "plugin.assert.privileged_not_supported",
        }),
      );
    });

    it("should refuse a privileged manifest the configuration did not ask for", () => {
      const plugin = new Plugin(
        instanceOf({ _manifest: { privileged: true } }),
      );

      expect(() => plugin.init("lambda-core")).toThrow(
        expect.objectContaining({ id: "plugin.assert.privileged_not_set" }),
      );
    });

    it("should refuse a manifest that wants another Kuzzle version", () => {
      const plugin = new Plugin(
        instanceOf({ _manifest: { kuzzleVersion: "42.21.0" } }),
      );

      expect(() => plugin.init("wrong-version")).toThrow(
        expect.objectContaining({ id: "plugin.manifest.version_mismatch" }),
      );
    });

    /* `includePrerelease` is why this passes: without it, semver excludes
     * every prerelease from a plain range. */
    it("should accept a prerelease range", () => {
      config.version = "2.28.0-beta.4";

      const plugin = new Plugin(
        instanceOf({ _manifest: { kuzzleVersion: ">2.27.0-beta.1" } }),
      );

      expect(() => plugin.init("prerelease")).not.toThrow();
    });
  });

  describe("#info", () => {
    it("should report an application's controllers, pipes and hooks", () => {
      const plugin = new Plugin(
        instanceOf({
          api: "api",
          hooks: {
            "document:afterCreate": "handler",
            "document:beforeCreate": "handler",
          },
          pipes: {
            "index:afterCreate": "handler",
            "index:beforeCreate": "handler",
          },
        }),
        { application: true, name: "lambda-core" },
      );

      plugin.version = "version";
      plugin.commit = "a-sha";

      expect(plugin.info()).toEqual({
        commit: "a-sha",
        controllers: "api",
        hooks: ["document:afterCreate", "document:beforeCreate"],
        name: "lambda-core",
        pipes: ["index:afterCreate", "index:beforeCreate"],
        version: "version",
      });
    });

    it("should report a plugin's registrations, namespaced by its name", () => {
      const plugin = new Plugin(
        instanceOf({
          controllers: { email: { send: () => {} } },
          hooks: { "document:afterCreate": "handler" },
          imports: { mappings: {} },
          pipes: { "index:afterCreate": "handler" },
          routes: ["routes"],
          strategies: { ldap: "LDAP" },
        }),
        { name: "lambda-core" },
      );

      plugin.version = "version";
      plugin.manifest = invalid("manifest");

      expect(plugin.info()).toEqual({
        controllers: ["lambda-core/email"],
        hooks: ["document:afterCreate"],
        imports: ["mappings"],
        manifest: "manifest",
        pipes: ["index:afterCreate"],
        routes: ["routes"],
        strategies: ["ldap"],
        version: "version",
      });
    });

    /* A plugin that registers nothing reports the empty shape, not a shape
     * with holes in it: `info()` feeds `server:info`. */
    it("should report empty lists for a plugin that registers nothing", () => {
      const plugin = new Plugin(instanceOf(), { name: "bare" });

      expect(plugin.info()).toEqual({
        controllers: [],
        hooks: [],
        imports: {},
        manifest: null,
        pipes: [],
        routes: [],
        strategies: [],
        version: "",
      });
    });
  });

  describe("Plugin.loadFromDirectory", () => {
    /** `loadPluginsErrors` writes into the process-wide error registry. */
    const registered = () => errorCodes.domains.plugin.subDomains as any;

    afterEach(() => {
      delete registered()["with-errors"];
      delete registered()["invalid-errors"];
    });

    it("should load a plugin, its manifest and its version from disk", () => {
      const plugin = Plugin.loadFromDirectory(fixture("lambda-core"));

      expect(plugin.name).toBe("lambda-core");
      expect(plugin.version).toBe("4.2.0");
      expect(plugin.manifest?.raw).toEqual({
        kuzzleVersion: ">=2.x",
        name: "lambda-core",
      });
      expect(typeof plugin.instance.init).toBe("function");
    });

    it("should refuse a path that is not a directory", () => {
      expect(() =>
        Plugin.loadFromDirectory(fixture("lambda-core/package.json")),
      ).toThrow(expect.objectContaining({ id: "plugin.assert.cannot_load" }));
    });

    it("should load the custom errors a manifest declares", () => {
      const plugin = Plugin.loadFromDirectory(fixture("with-errors"));

      expect(logger.info).toHaveBeenCalledWith(
        "[with-errors] Custom errors successfully loaded.",
      );
      expect(registered()["with-errors"].errors).toEqual(
        plugin.manifest?.raw?.errors,
      );
    });

    it("should refuse custom errors that are badly formatted", () => {
      expect(() => Plugin.loadFromDirectory(fixture("invalid-errors"))).toThrow(
        expect.objectContaining({ id: "plugin.manifest.invalid_errors" }),
      );
    });

    it("should refuse a directory with no manifest.json", () => {
      expect(() => Plugin.loadFromDirectory(fixture("no-manifest"))).toThrow(
        expect.objectContaining({ id: "plugin.manifest.cannot_load" }),
      );
    });

    it("should refuse a plugin that exposes no init function", () => {
      expect(() => Plugin.loadFromDirectory(fixture("not-a-plugin"))).toThrow(
        expect.objectContaining({ id: "plugin.assert.init_not_found" }),
      );
    });

    it("should refuse a directory that holds no module at all", () => {
      expect(() => Plugin.loadFromDirectory(fixture("."))).toThrow(
        expect.objectContaining({ id: "plugin.runtime.unexpected_error" }),
      );
    });
  });

  describe("Plugin.checkName", () => {
    it.each([
      ["lambda-core", true],
      ["lambda1", true],
      ["LambdaCore", false],
      ["lambda_core", false],
      ["lambda core", false],
    ])("should answer %s → %s", (name, expected) => {
      expect(Plugin.checkName(name as string)).toBe(expected);
    });
  });
});
