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

import fs from "node:fs";
import path from "node:path";

import type { JSONObject } from "kuzzle-sdk";
import * as semver from "semver";

import defaultConfig from "../../config/default.config";
import * as kerror from "../../kerror";
import * as errorCodes from "../../kerror/codes";
import type { ControllerDefinition } from "../../types";
import type { PluginInstance, PluginOptions } from "../../types/PluginInstance";
import { has, isPlainObject } from "../../util/safeObject";
import Manifest from "./pluginManifest";
import { PluginContext } from "./pluginContext";
import PrivilegedPluginContext from "./privilegedContext";

const assertionError = kerror.wrap("plugin", "assert");
const runtimeError = kerror.wrap("plugin", "runtime");

const PLUGIN_NAME_REGEX = /^[a-z-\d]+$/;
const HTTP_VERBS = new Set([
  "get",
  "head",
  "post",
  "put",
  "delete",
  "patch",
  "options",
]);

/**
 * What `info()` reports for a plugin — the names of what it registers, not the
 * registrations themselves.
 */
interface PluginDescription {
  version: string;
  controllers: string[];
  hooks: string[];
  manifest: Manifest | null;
  pipes: string[];
  routes: JSONObject[];
  strategies: string[];
  imports: string[] | JSONObject;
}

/**
 * Kuzzle's own wrapper around a plugin: its name, config, context and manifest,
 * plus the assertions a plugin must satisfy before it is loaded.
 *
 * Not to be confused with `lib/types/Plugin.ts`'s `Plugin`, which is the
 * abstract class a plugin author extends. This one wraps an instance of that.
 */
class Plugin {
  private readonly _instance: PluginInstance;
  private readonly _application: boolean;
  private _config: JSONObject;
  private _context: PluginContext | null;
  private _version: string;
  private _name: string;
  private _manifest: Manifest | null;
  private _deprecationWarning: boolean;

  /**
   * Set by `PluginsManager` once the plugin's own `init` has resolved.
   *
   * The JavaScript declared a `_initCalled` in the constructor and never read
   * it: what the manager actually sets, and what the specs assert, is this
   * public `initCalled`, created ad hoc on the object. The dead field is gone
   * and the live one is declared.
   */
  public initCalled = false;

  /**
   * Set from the outside by `Backend`, which reads it from the git tree — the
   * wrapper has no way to derive it. `info()` reports it for an application.
   */
  public commit: string | null = null;

  /** Set from the outside by `Backend`, like `commit`. */
  public openApi: JSONObject | null = null;

  constructor(
    instance: PluginInstance,
    {
      name,
      application = false,
      deprecationWarning = true,
    }: PluginOptions = {},
  ) {
    this._instance = instance;

    this._application = application;

    this._config = {};
    this._context = null;
    this._version = instance.version || "";
    this._name = "";
    this._manifest = instance._manifest || null;
    this._deprecationWarning = deprecationWarning;

    if (name) {
      this.name = name;
    }
  }

  init(name: string): void {
    this.name = name;

    const configured = global.kuzzle.config.plugins[this.name];

    if (configured) {
      // structuredClone is not equivalent: a plugin's configuration is user
      // data that has been through JSON, and swapping clone semantics in a
      // conversion is out of scope.
      this.config = JSON.parse(JSON.stringify(configured)); // NOSONAR
    }

    // check plugin privileged prerequisites
    // user need to acknowledge privileged mode in plugin configuration
    if (this.config.privileged) {
      if (!this.manifest?.privileged) {
        throw assertionError.get("privileged_not_supported", this.name);
      }
    } else if (this.manifest?.privileged) {
      throw assertionError.get("privileged_not_set", this.name);
    }

    if (this.manifest?.kuzzleVersion) {
      if (
        !semver.satisfies(
          global.kuzzle.config.version,
          this.manifest.kuzzleVersion,
          { includePrerelease: true },
        )
      ) {
        throw kerror.get(
          "plugin",
          "manifest",
          "version_mismatch",
          this.name,
          global.kuzzle.config.version,
          this.manifest.kuzzleVersion,
        );
      }
    }

    this._context = this.config.privileged
      ? new PrivilegedPluginContext(this.name)
      : new PluginContext(this.name);
  }

  info(): JSONObject {
    /* eslint-disable sort-keys */
    if (this.application) {
      return {
        name: this.name,
        version: this.version,
        commit: this.commit,
        controllers: this.instance.api,
        pipes: Object.keys(this.instance.pipes),
        hooks: Object.keys(this.instance.hooks),
      };
    }

    const description: PluginDescription = {
      version: this.version,
      controllers: [],
      hooks: [],
      manifest: this.manifest,
      pipes: [],
      routes: [],
      strategies: [],
      imports: {},
    };
    /* eslint-enable sort-keys */

    if (has(this.instance, "imports")) {
      description.imports = Object.keys(this.instance.imports);
    }

    if (has(this.instance, "hooks")) {
      description.hooks = Object.keys(this.instance.hooks);
    }

    if (has(this.instance, "pipes")) {
      description.pipes = Object.keys(this.instance.pipes);
    }

    if (has(this.instance, "controllers")) {
      description.controllers = Object.keys(this.instance.controllers).map(
        (controller) => `${this.name}/${controller}`,
      );
    }

    if (has(this.instance, "routes")) {
      description.routes = this.instance.routes;
    }

    if (has(this.instance, "strategies")) {
      description.strategies = Object.keys(this.instance.strategies);
    }

    return description;
  }

  printDeprecation(message: string): void {
    if (this.deprecationWarning) {
      global.kuzzle.log.warn(`${this.logPrefix} ${message}`);
    }
  }

  // getters/setters ===========================================================

  get instance(): PluginInstance {
    return this._instance;
  }

  get context(): PluginContext | null {
    return this._context;
  }

  get application(): boolean {
    return this._application;
  }

  get logPrefix(): string {
    return `[${this.name}]`;
  }

  get config(): JSONObject {
    return this._config;
  }
  set config(config: JSONObject) {
    this._config = config;
  }

  get version(): string {
    return this._version;
  }
  set version(version: string) {
    this._version = version;
  }

  get deprecationWarning(): boolean {
    return this._deprecationWarning;
  }
  set deprecationWarning(value: boolean) {
    this._deprecationWarning = value;
  }

  get name(): string {
    return this._name;
  }
  set name(name: string) {
    // `Plugin.checkName` rather than `this.constructor.checkName`: nothing
    // extends this class, and the static-through-instance form is not typable
    // without an assertion.
    if (!Plugin.checkName(name)) {
      this.printDeprecation(
        "Plugin names should be in kebab-case. This behavior will be enforced in futur versions of Kuzzle.",
      );
    }

    this._name = name;
  }

  get manifest(): Manifest | null {
    return this._manifest;
  }
  set manifest(manifest: Manifest | null) {
    this._manifest = manifest;
  }

  // static methods ============================================================

  static loadFromDirectory(pluginPath: string): Plugin {
    if (!fs.statSync(pluginPath).isDirectory()) {
      throw assertionError.get("cannot_load", pluginPath, "Not a directory.");
    }

    let plugin: Plugin;
    let PluginClass: { new (): PluginInstance; name?: string } = null;
    try {
      // A plugin is loaded from disk at runtime: the path is only known then,
      // so this require is the feature, not an unconverted import.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      PluginClass = require(pluginPath);

      const pluginInstance = new PluginClass();

      plugin = new Plugin(pluginInstance);
    } catch (error) {
      if (error.message.match(/not a constructor/i)) {
        throw assertionError.get("not_a_constructor", PluginClass.name);
      }

      throw runtimeError.getFrom(error, "unexpected_error", error.message);
    }

    // load manifest
    plugin.manifest = new Manifest(pluginPath);
    plugin.manifest.load();

    plugin.name = plugin.manifest.name;

    // load plugin version if exists
    const packageJsonPath = path.join(pluginPath, "package.json");
    if (fs.existsSync(packageJsonPath) && !plugin.version) {
      // Same as the plugin's own module above: a path known only at runtime.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      plugin.version = require(packageJsonPath).version;
    }

    loadPluginErrors(plugin);

    // check if the plugin exposes a "init" method
    if (typeof plugin.instance.init !== "function") {
      throw assertionError.get("init_not_found", plugin.name);
    }

    return plugin;
  }

  static checkName(name: string): boolean {
    return PLUGIN_NAME_REGEX.test(name);
  }

  static checkControllerDefinition(
    name: string,
    definition: ControllerDefinition | undefined,
    { application = false }: { application?: boolean } = {},
  ): asserts definition is ControllerDefinition {
    if (typeof name !== "string") {
      throw assertionError.get(
        "invalid_controller_definition",
        "Controller name must be a string",
      );
    }

    if (!isPlainObject(definition)) {
      throw assertionError.get(
        "invalid_controller_definition",
        name,
        "Controller definition must be an object",
      );
    }

    if (!isPlainObject(definition.actions)) {
      throw assertionError.get(
        "invalid_controller_definition",
        name,
        'Controller definition "actions" property must be an object',
      );
    }

    for (const [action, actionDefinition] of Object.entries(
      definition.actions,
    )) {
      checkActionDefinition(name, action, actionDefinition, application);
    }
  }
}

/**
 * Checks one action of a controller definition. Lifted verbatim out of
 * `Plugin.checkControllerDefinition`, whose cognitive complexity the
 * `.js` → `.ts` rename re-scored as new code.
 */
/**
 * Loads a plugin's custom error definitions, if its manifest declares any.
 * Lifted verbatim out of `Plugin.loadFromDirectory` for the same gate reason.
 */
function loadPluginErrors(plugin: Plugin): void {
  if (plugin.manifest.raw.errors) {
    try {
      // we use the manifest name instead of the lowerCased plugin name
      // to ensure to match the plugin original name in the configuration
      const config = global.kuzzle.config[plugin.manifest.name];
      const pluginCode = config?._pluginCode ? config._pluginCode : 0x00;

      // The two properties `loadPluginsErrors` reads, named explicitly:
      // `raw` is a JSONObject and cannot be narrowed to the shape it wants
      // without an assertion. Same values, same call.
      errorCodes.loadPluginsErrors(
        {
          errors: plugin.manifest.raw.errors,
          name: plugin.manifest.raw.name,
        },
        pluginCode,
      );

      global.kuzzle.log.info(
        `${plugin.logPrefix} Custom errors successfully loaded.`,
      );
    } catch (err) {
      if (
        err.message.match(/Error configuration file/i) ||
        err instanceof SyntaxError
      ) {
        throw kerror.getFrom(
          err,
          "plugin",
          "manifest",
          "invalid_errors",
          plugin.manifest.name,
          err.message,
        );
      }

      throw err;
    }
  }
}

function checkActionDefinition(
  name: string,
  action: string,
  actionDefinition: JSONObject,
  application: boolean,
): void {
  // Parenthesised: `!a?.b ?? c` parses as `(!a?.b) ?? c`, and `!x` is never
  // nullish, so the fallback was dead code. It happens to be equivalent
  // today only because the packaged default is `false` — it would not be if
  // that default ever became `true`.
  if (!(
    global.app.config.content.controllers?.definition
      ?.allowAdditionalActionProperties ??
    defaultConfig.controllers.definition.allowAdditionalActionProperties
  )) {
    const actionProperties = Object.keys(actionDefinition).filter(
      (prop) => prop !== "handler" && prop !== "http",
    );

    if (actionProperties.length > 0) {
      throw assertionError.get(
        "invalid_controller_definition",
        name,
        `action "${action}" has invalid properties: ${actionProperties.join(
          ", ",
        )}`,
      );
    }
  }

  if (typeof action !== "string") {
    throw assertionError.get(
      "invalid_controller_definition",
      name,
      "action names must be strings",
    );
  }

  if (typeof actionDefinition.handler !== "function") {
    throw assertionError.get(
      "invalid_controller_definition",
      name,
      `action "${action}" handler must be a function`,
    );
  }

  if (actionDefinition.http) {
    if (!Array.isArray(actionDefinition.http)) {
      throw assertionError.get(
        "invalid_controller_definition",
        name,
        `action "${action}" http definition must be an array`,
      );
    }

    for (const route of actionDefinition.http) {
      checkHttpRoute(route, action, name, application);
    }
  }
}

/**
 * Checks one HTTP route of an action definition. Second half of the same
 * gate-driven split as `checkActionDefinition`.
 */
function checkHttpRoute(
  route: JSONObject,
  action: string,
  name: string,
  application: boolean,
): void {
  if (typeof route.verb !== "string" || route.verb.length === 0) {
    throw assertionError.get(
      "invalid_controller_definition",
      name,
      `action "${action}" http "verb" property must be a non-empty string`,
    );
  }

  if (!HTTP_VERBS.has(route.verb.toLowerCase())) {
    throw assertionError.get(
      "invalid_controller_definition",
      name,
      `action "${action}" http verb "${route.verb}" is not a valid http verb`,
    );
  }

  checkHttpRouteProperties(route, action, name, application);

  const routeProperties = Object.keys(route);
  if (routeProperties.length > 3) {
    routeProperties.splice(routeProperties.indexOf("url"), 1);
    routeProperties.splice(routeProperties.indexOf("path"), 1);
    routeProperties.splice(routeProperties.indexOf("verb"), 1);
    routeProperties.splice(routeProperties.indexOf("openapi"), 1);

    throw assertionError.get(
      "invalid_controller_definition",
      name,
      `action "${action}" has invalid http properties: ${routeProperties.join(
        ", ",
      )}`,
    );
  }
}

function checkHttpRouteProperties(
  route: JSONObject,
  action: string,
  name: string,
  application: boolean,
): void {
  if (typeof route.path !== "string" || route.path.length === 0) {
    if (!application && typeof route.url === "string" && route.url.length > 0) {
      return;
    }

    throw assertionError.get(
      "invalid_controller_definition",
      name,
      `action "${action}" http "path" property must be a non-empty string`,
    );
  }
}

export = Plugin;
