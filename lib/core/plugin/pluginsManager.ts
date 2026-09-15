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

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import Bluebird from "bluebird";
import type { JSONObject } from "kuzzle-sdk";
import { isEmpty, isFunction, isNil, isString, merge } from "lodash";

import {
  BaseController,
  type ControllerAction,
} from "../../api/controllers/baseController";
import type { ApiRoute } from "../../types/ApiRoute";
import * as kerror from "../../kerror";
import { KuzzleError } from "../../kerror/errors";
import createDebug from "../../util/debug";
import didYouMean from "../../util/didYouMean";
import { Inflector } from "../../util/Inflector";
import { has, isPlainObject } from "../../util/safeObject";
import type { PluginInstance } from "../../types/PluginInstance";
import Plugin from "./plugin";

const debug = createDebug("kuzzle:plugins");

const assertionError = kerror.wrap("plugin", "assert");
const runtimeError = kerror.wrap("plugin", "runtime");
const strategyError = kerror.wrap("plugin", "strategy");
const controllerError = kerror.wrap("plugin", "controller");

// Without those plugins, Kuzzle won't start at all.
const CORE_PLUGINS = new Set(["kuzzle-plugin-auth-passport-local"]);

/**
 * Any function a plugin exposes: a pipe, a hook, an action handler, a strategy
 * method. A plugin's members are `unknown` by construction — it is a
 * user-supplied object — so this is the type a `typeof … === "function"` check
 * produces, and what `bindPluginMethod` answers.
 */
type PluginMethod = (...args: unknown[]) => unknown;

/**
 * A strategy as a plugin hands it over: `JSONObject`, not
 * `StrategyDefinition[string]`, because nothing has checked its shape yet —
 * `validateStrategy` is what does, at runtime, and it is the reason this
 * parameter cannot claim the validated type.
 */
type StrategyEntry = JSONObject;

/**
 * A strategy once registered: the declaration, the plugin that owns it, and the
 * methods resolved and bound from the names the declaration carries.
 */
/**
 * A strategy method, resolved from its name and bound to the plugin instance.
 *
 * The return is whatever the plugin's method answers — `exists` gives a boolean,
 * `getInfo` an object — so `JSONObject` describes what the *callers* read off it
 * rather than a promise the plugins make. That is the same latitude the JSDoc's
 * `{object}` gave, kept rather than narrowed, because narrowing it is an API
 * decision and this is a conversion.
 */
type StrategyMethod = (...args: unknown[]) => Promise<JSONObject>;

interface RegisteredStrategy {
  methods: JSONObject;
  owner: string;
  strategy: StrategyEntry;
}

class PluginsManager {
  private _plugins: Map<string, Plugin>;
  public controllers: Map<string, BaseController>;
  public strategies: Record<string, RegisteredStrategy>;
  public routes: ApiRoute[];
  public pluginsEnabledDir: string;
  public pluginsAvailableDir: string;
  public authenticators: JSONObject;
  public config: JSONObject;
  public logger: ReturnType<typeof global.kuzzle.log.child>;
  public loadedPlugins: string[];

  constructor() {
    Reflect.defineProperty(this, "kuzzle", {
      value: global.kuzzle,
    });

    this._plugins = new Map();

    // Map.<controller, BaseController instance >
    this.controllers = new Map();

    this.strategies = {};
    this.routes = [];

    this.pluginsEnabledDir = path.resolve(
      path.join(global.kuzzle.rootPath, "plugins", "enabled"),
    );
    this.pluginsAvailableDir = path.resolve(
      path.join(global.kuzzle.rootPath, "plugins", "available"),
    );

    /**
     * @example
     * {
     *   pluginName: {
     *     authName: <constructor>,
     *     authname2: <constructor>,
     *     ...
     *   },
     *   pluginName2: {
     *     ...
     *   }
     * }
     *
     * This structure prevents authenticator names collisions between
     * multiple auth. plugins
     */
    this.authenticators = {};

    this.config = global.kuzzle.config.plugins;

    this.logger = global.kuzzle.log.child("core:plugin:pluginsManager");

    // @deprecated - Warn about the pipeTimeout configuration being obsolete
    if (this.config.common.pipeTimeout) {
      this.logger.warn(
        'The configuration "plugins.common.pipeTimeout" has been deprecated and is now unused. It can be safely removed from configuration files',
      );
    }

    this.loadedPlugins = [];
  }

  set application(plugin: Plugin) {
    assert(
      this._plugins.size === 0,
      "The application plugin can only be set before every other plugins are loaded",
    );
    assert(
      plugin.application,
      'The application plugin must have the "application" property equals to true',
    );

    this._plugins.set(plugin.name, plugin);
  }

  get plugins(): Plugin[] {
    return Array.from(this._plugins.values()).filter(
      (plugin) => !plugin.application,
    );
  }

  get application(): Plugin {
    return Array.from(this._plugins.values()).find(
      (plugin) => plugin.application,
    );
  }

  /**
   * Giving a controller name, tells if exists
   *
   * @param {string} controller
   * @returns {Boolean}
   */
  isController(controller: string): boolean {
    return this.controllers.has(controller);
  }

  /**
   * Giving a controller name and an action, tells if action exists
   *
   * @param {string} controller
   * @param {string} action
   * @returns {Boolean}
   */
  isAction(controller: string, action: string): boolean {
    return this.getActions(controller).includes(action);
  }

  /**
   * Giving a controller name, returns its actions
   *
   * @param {string} controller
   * @returns {Array}
   */
  getActions(controller: string): string[] {
    return Array.from(this.controllers.get(controller)._actions);
  }

  /**
   * Returns an array filled with controller names
   *
   * @returns {Array}
   */
  getControllerNames(): string[] {
    return Array.from(this.controllers.keys());
  }

  /**
   * Giving a plugin name, tell if it exists
   *
   * @param {string} pluginName
   * @returns {boolean}
   */

  exists(pluginName: string): boolean {
    return this._plugins.has(pluginName);
  }

  /**
   * Used to dump loaded plugin feature into serverInfo route / cli
   *
   * @returns {object}
   */
  getPluginsDescription(): JSONObject {
    const pluginsDescription = {};

    for (const plugin of this.plugins) {
      pluginsDescription[plugin.name] = plugin.info();

      debug(
        "[%s] reading plugin configuration: %a",
        plugin,
        pluginsDescription[plugin.name],
      );
    }

    return pluginsDescription;
  }

  /**
   * Register plugins feature to Kuzzle
   *
   * @returns {Promise}
   *
   * @throws PluginImplementationError - Throws when an error occurs when registering a plugin
   */
  async init(plugins: JSONObject = {}): Promise<JSONObject> {
    this._plugins = new Map([...this.loadPlugins(plugins), ...this._plugins]);

    global.kuzzle.on("plugin:hook:loop-error", ({ error, pluginName }) => {
      this.logger.error(
        `[${pluginName}] Infinite loop detected on event "hook:onError": ${error}`,
      );
    });

    global.kuzzle.on("hook:onError", ({ error, event, pluginName }) => {
      this.logger.error(
        `[${pluginName}] Error executing hook on "${event}": ${error}${error.stack}`,
      );
    });

    // register regular plugins features
    const loadPlugins = [];
    const defaultImports = {};

    for (const plugin of this._plugins.values()) {
      if (this.config.common.failsafeMode && !CORE_PLUGINS.has(plugin.name)) {
        this.logger.info(
          `Failsafe mode activated, skipping plugin "${plugin.name}"`,
        );
        continue;
      }

      if (plugin.application) {
        plugin.init(plugin.name);
      }

      const { initTimeout } = this.config.common;

      debug(
        '[%s] starting plugin in "%s" mode',
        plugin.name,
        plugin.config.privileged ? "privileged" : "standard",
      );

      const promise = Bluebird.resolve(
        (async () => {
          try {
            await plugin.instance.init(plugin.config, plugin.context);
          } catch (error) {
            throw runtimeError.get("failed_init", plugin.name, error);
          }
        })(),
      )
        .timeout(
          initTimeout,
          `${plugin.logPrefix} Initialization timed out after ${initTimeout}ms. Try to increase the configuration "plugins.common.initTimeout".`,
        )
        .then(async () => {
          plugin.initCalled = true;

          if (
            !isEmpty(plugin.instance.controllers) &&
            !isEmpty(plugin.instance.api)
          ) {
            throw assertionError.get("duplicated_api_definition");
          }

          if (!isEmpty(plugin.instance.controllers)) {
            this._initControllers(plugin);
          }

          if (!isEmpty(plugin.instance.api)) {
            await this._initApi(plugin);
          }

          if (!isEmpty(plugin.instance.authenticators)) {
            this._initAuthenticators(plugin);
          }

          if (!isEmpty(plugin.instance.strategies)) {
            this._initStrategies(plugin);
          }

          if (!isEmpty(plugin.instance.hooks)) {
            this._initHooks(plugin);
          }

          if (!isEmpty(plugin.instance.pipes)) {
            this._initPipes(plugin);
          }

          debug("[%s] plugin started", plugin.name);

          if (!plugin.application) {
            this.loadedPlugins.push(plugin.name);
          }

          if (!isEmpty(plugin.instance.imports)) {
            merge(defaultImports, plugin.instance.imports);
          }

          return null;
        });

      loadPlugins.push(promise);
    }

    await Promise.all(loadPlugins);

    this.logger.info(
      `[✔] Successfully loaded ${
        this.loadedPlugins.length
      } plugins: ${this.loadedPlugins.join(", ")}`,
    );

    return defaultImports;
  }

  /**
   * @param {string} strategyName
   * @returns {string[]}
   */
  getStrategyFields(strategyName: string): string[] {
    return this.strategies[strategyName].strategy.config.fields || [];
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {boolean}
   */
  hasStrategyMethod(strategyName: string, methodName: string): boolean {
    const strategy = has(this.strategies, strategyName)
      ? this.strategies[strategyName]
      : undefined;

    return strategy !== undefined && has(strategy.methods, methodName);
  }

  /**
   * @param {string} strategyName
   * @param {string} methodName
   * @returns {function}
   */
  getStrategyMethod(strategyName: string, methodName: string): StrategyMethod {
    return this.strategies[strategyName].methods[methodName];
  }

  /**
   * Returns the list of registered passport strategies
   * @returns {string[]}
   */
  listStrategies(): string[] {
    return Object.keys(this.strategies);
  }

  /**
   * Checks if a strategy is well-formed
   *
   * @param {string} pluginName
   * @param {string} strategyName
   * @param {object} strategy
   * @throws {PluginImplementationError} If the strategy is invalid
   */
  validateStrategy(
    pluginName: string,
    strategyName: string,
    strategy: StrategyEntry,
  ): void {
    const errorPrefix = `[${pluginName}] Strategy ${strategyName}:`;

    if (!isPlainObject(strategy)) {
      throw strategyError.get("invalid_description", errorPrefix, strategy);
    }

    if (!isPlainObject(strategy.methods)) {
      throw strategyError.get("invalid_methods", errorPrefix, strategy.methods);
    }

    const plugin = this._plugins.get(pluginName.toLowerCase());

    // required methods check
    ["exists", "create", "update", "delete", "validate", "verify"].forEach(
      (methodName) => {
        if (!isString(strategy.methods[methodName])) {
          throw strategyError.get(
            "invalid_method_type",
            errorPrefix,
            methodName,
            strategy.methods[methodName],
          );
        }

        if (!isFunction(plugin.instance[strategy.methods[methodName]])) {
          throw strategyError.get(
            "missing_method_function",
            errorPrefix,
            strategy.methods[methodName],
          );
        }
      },
    );

    // optional methods check
    ["getInfo", "getById", "afterRegister"].forEach((name) => {
      const optionalMethodName = strategy.methods[name];

      if (!isNil(optionalMethodName)) {
        if (!isString(optionalMethodName)) {
          throw strategyError.get(
            "invalid_method_type",
            errorPrefix,
            name,
            optionalMethodName,
          );
        }

        if (!isFunction(plugin.instance[optionalMethodName])) {
          throw strategyError.get(
            "missing_method_function",
            errorPrefix,
            optionalMethodName,
          );
        }
      }
    });

    if (!isPlainObject(strategy.config)) {
      throw strategyError.get("invalid_config", errorPrefix, strategy.config);
    }

    if (typeof strategy.config.authenticator !== "string") {
      throw strategyError.get(
        "invalid_authenticator",
        errorPrefix,
        strategy.config.authenticator,
      );
    } else if (
      !this.authenticators[pluginName]?.[strategy.config.authenticator]
    ) {
      throw strategyError.get(
        "unknown_authenticator",
        errorPrefix,
        strategy.config.authenticator,
      );
    }

    for (const optionName of ["strategyOptions", "authenticateOptions"]) {
      const options = strategy.config[optionName];

      if (!isNil(options) && !isPlainObject(options)) {
        throw strategyError.get(
          "invalid_option",
          errorPrefix,
          optionName,
          options,
        );
      }
    }

    if (
      !isNil(strategy.config.fields) &&
      !Array.isArray(strategy.config.fields)
    ) {
      throw strategyError.get(
        "invalid_fields",
        errorPrefix,
        strategy.config.fields,
      );
    }
  }

  /**
   * Register a pipe function on an event
   *
   * @param {object} plugin
   * @param {number} warnDelay - delay before a warning is issued
   * @param {string} event name
   * @param {Function} handler - function to attach
   *
   * @returns {string} pipeId
   */
  registerPipe(plugin: Plugin, event: string, handler: PluginMethod): string {
    debug('[%s] registering pipe on event "%s"', plugin.name, event);

    const warnDelay =
      plugin.config.pipeWarnTime !== undefined
        ? plugin.config.pipeWarnTime
        : this.config.common.pipeWarnTime;

    const wrapper = (...data) => {
      const now = warnDelay ? Date.now() : null;
      const callback = data.pop();

      const cb = (error: Error | null, result?: unknown) => {
        if (warnDelay) {
          const elapsed = Date.now() - now;

          if (elapsed > warnDelay) {
            this.logger.warn(
              `${plugin.logPrefix} pipe for event '${event}' is slow (${elapsed}ms)`,
            );
          }
        }

        callback(error, result);
      };

      try {
        const pipeResponse =
          data.length === 0 ? handler(null, cb) : handler(...data, cb);

        if (isThenable(pipeResponse)) {
          pipeResponse
            .then((result) => {
              cb(null, result);
              return null; // prevents a false-positive bluebird warning
            })
            .catch((error) => cb(error));
        }
      } catch (error) {
        cb(
          error instanceof KuzzleError
            ? error
            : runtimeError.getFrom(error, "unexpected_error", error.message),
        );
      }
    };

    return global.kuzzle.registerPluginPipe(event, wrapper);
  }

  unregisterPipe(pipeId: string): void {
    global.kuzzle.unregisterPluginPipe(pipeId);
  }

  /**
   * Registers an authentication strategy.
   * If the plugin init method has not been called yet, add the strategy to
   * the plugin.instance.strategies object.
   *
   * @param {string} pluginName - plugin name
   * @param {string} strategyName - strategy name
   * @param {object} strategy - strategy properties
   * @throws {PluginImplementationError} If the strategy is invalid or if
   *                                     registration fails
   */
  registerStrategy(
    pluginName: string,
    strategyName: string,
    strategy: StrategyEntry,
  ): void {
    // prior to Kaaf, plugin names can contains upper case
    const plugin = this._plugins.get(pluginName.toLowerCase());

    // only add the strategy to the strategies object if the init method
    // has not been called
    if (!plugin.initCalled) {
      plugin.instance.strategies = plugin.instance.strategies || {};
      plugin.instance.strategies[strategyName] = strategy;

      return;
    }

    this.validateStrategy(plugin.name, strategyName, strategy);

    if (has(this.strategies, strategyName)) {
      this.unregisterStrategy(plugin.name, strategyName);
    }

    const methods: JSONObject = {};

    // wrap plugin methods to force their context and to
    // convert uncaught exception into PluginImplementationError
    // promise rejections
    for (const methodName of Object.keys(strategy.methods).filter(
      (name) => name !== "verify",
    )) {
      methods[methodName] = async (...args) => {
        try {
          const boundFunction = bindPluginMethod(
            plugin.instance,
            strategy.methods[methodName],
          );

          return await boundFunction(...args);
        } catch (error) {
          if (error instanceof KuzzleError) {
            throw error;
          }

          throw runtimeError.getFrom(error, "unexpected_error", error.message);
        }
      };
    }

    const opts = {
      ...strategy.config.strategyOptions,
      passReqToCallback: true,
    };

    const verifyAdapter = this.wrapStrategyVerify(
      plugin.logPrefix,
      strategyName,
      bindPluginMethod(plugin.instance, strategy.methods.verify),
    );

    try {
      const Ctor =
          this.authenticators[plugin.name][strategy.config.authenticator],
        instance = new Ctor(opts, verifyAdapter);

      this.strategies[strategyName] = { methods, owner: plugin.name, strategy };
      global.kuzzle.passport.use(
        strategyName,
        instance,
        strategy.config.authenticateOptions,
      );

      if (methods.afterRegister) {
        methods.afterRegister(instance);
      }
    } catch (e) {
      throw strategyError.getFrom(
        e,
        "failed_registration",
        strategyName,
        e.message,
      );
    }
  }

  /**
   * Unregister
   * @param {string} pluginName
   * @param  {string} strategyName
   * @throws {PluginImplementationError} If not the owner of the strategy or if strategy
   *                                     does not exist
   */
  unregisterStrategy(pluginName: string, strategyName: string): void {
    const strategy = this.strategies[strategyName];

    if (strategy) {
      if (strategy.owner !== pluginName) {
        throw strategyError.get("unauthorized_removal", strategyName);
      }

      delete this.strategies[strategyName];
      global.kuzzle.passport.unuse(strategyName);
    } else {
      throw strategyError.get("strategy_not_found", strategyName);
    }
  }

  /**
   * @param {object} plugin
   * @param {number} pipeWarnTime
   */
  _initPipes(plugin: Plugin): void {
    const methodsList = getMethods(plugin.instance);

    for (const [event, fn] of Object.entries(plugin.instance.pipes)) {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        const handler = this.resolveEventHandler(
          plugin,
          event,
          target,
          methodsList,
          "invalid_pipe",
          "Defining pipe handler using a string is deprecated. Pass a function instead.",
        );

        this.registerPipe(plugin, event, handler);
      }
    }
  }

  /**
   * Resolves one pipe or hook target — a function, or the name of a plugin
   * method — into the handler to register.
   *
   * Shared by `_initPipes` and `_initHooks`, which carried the same twenty
   * lines with two words changed. The `.js` → `.ts` rename re-scored both as
   * new code, so the gate asked for the deduplication the files already wanted.
   *
   * @throws {PluginImplementationError} when the target names nothing callable
   */
  private resolveEventHandler(
    plugin: Plugin,
    event: string,
    target: PluginMethod | string,
    methodsList: string[],
    errorId: "invalid_pipe" | "invalid_hook",
    deprecation: string,
  ): PluginMethod {
    if (
      typeof target !== "function" &&
      typeof plugin.instance[target] !== "function"
    ) {
      const message =
        typeof target === "string" ? didYouMean(target, methodsList) : "";

      throw assertionError.get(errorId, event, target, message);
    }

    // @deprecated - warn about using a string representing an instance method
    if (typeof target === "string") {
      plugin.printDeprecation(deprecation);

      return bindPluginMethod(plugin.instance, target);
    }

    // if the function handler is a plugin instance method,
    // bound the context to the plugin instance
    if (target.name && typeof plugin.instance[target.name] === "function") {
      return target.bind(plugin.instance);
    }

    return target;
  }

  /**
   * @param {object} plugin
   */
  _initHooks(plugin: Plugin): void {
    const methodsList = getMethods(plugin.instance);

    for (const [event, fn] of Object.entries(plugin.instance.hooks)) {
      const list = Array.isArray(fn) ? fn : [fn];

      for (const target of list) {
        debug('[%s] register hook on event "%s"', plugin.name, event);

        const handler = this.resolveEventHandler(
          plugin,
          event,
          target,
          methodsList,
          "invalid_hook",
          "Defining hook handler using a string is deprecated. Pass a function instead.",
        );

        global.kuzzle.registerPluginHook(plugin.name, event, handler);
      }
    }
  }

  async _initApi(plugin: Plugin): Promise<void> {
    for (const [controller, definition] of Object.entries(
      plugin.instance.api,
    )) {
      debug(
        "[%s][%s] starting api controller registration",
        plugin.name,
        controller,
      );

      if (
        await global.kuzzle.ask(
          "kuzzle:api:funnel:controller:isNative",
          controller,
        )
      ) {
        throw assertionError.get(
          "invalid_controller_definition",
          controller,
          "Native controllers cannot be overriden",
        );
      }

      Plugin.checkControllerDefinition(controller, definition);

      for (const [action, actionDefinition] of Object.entries(
        definition.actions,
      )) {
        const httpRoutes = this.registerApiAction(
          plugin,
          controller,
          action,
          actionDefinition,
        );

        for (const httpRoute of httpRoutes) {
          debug(
            '[%s] binding HTTP route "%s" to controller "%s"',
            plugin.name,
            httpRoute.path,
            controller,
          );

          const routePath = httpRoute.path.startsWith("/")
            ? httpRoute.path
            : `/_/${httpRoute.path}`;

          this.routes.push({
            action,
            controller,
            openapi: httpRoute.openapi,
            path: routePath,
            verb: httpRoute.verb,
          });
        }
      }
    }
  }

  /**
   * Init plugin controllers
   *
   * @param {object} plugin
   * @returns {boolean}
   */
  _initControllers(plugin: Plugin): void {
    // @deprecated - warn about using the obsolete "controllers" object
    if (!isEmpty(plugin.instance.controllers)) {
      plugin.printDeprecation(
        'Defining controllers using the "controllers" object is deprecated. You should use the "api" object instead.',
      );
    }

    for (const controller of Object.keys(plugin.instance.controllers)) {
      debug(
        "[%s][%s] starting controller registration",
        plugin.name,
        controller,
      );

      const methodsList = getMethods(plugin.instance);
      const controllerName = `${plugin.name}/${controller}`;
      const definition: JSONObject = plugin.instance.controllers[controller];
      const errorControllerPrefix = `Unable to inject controller "${controller}" from plugin "${plugin.name}":`;

      if (!isPlainObject(definition)) {
        // @todo deprecate all those errors and use plugin.assert.invalid_controller_definition
        throw controllerError.get(
          "invalid_description",
          errorControllerPrefix,
          typeof definition,
        );
      }

      for (const action of Object.keys(definition)) {
        debug(
          "[%s][%s][%s] starting action controller registration",
          plugin.name,
          controller,
          action,
        );

        this.registerLegacyAction(
          plugin,
          definition[action],
          { action, controller, controllerName, errorControllerPrefix },
          methodsList,
        );
      }
    }

    const httpVerbs = [
      "get",
      "head",
      "post",
      "put",
      "delete",
      "patch",
      "options",
    ];
    const routeProperties = ["verb", "url", "controller", "action", "path"];
    const controllerNames = Object.keys(plugin.instance.controllers);

    // @deprecated - warn about using the obsolete "routes" object
    if (!isEmpty(plugin.instance.routes)) {
      plugin.printDeprecation(
        'Defining routes using the "routes" object is deprecated. You should use the "api" object instead.',
      );
    }

    for (const route of plugin.instance.routes || []) {
      const controller = `${plugin.name}/${route.controller}`;
      const errorRoutePrefix = `Unable to inject API route "${JSON.stringify(
        route,
      )}" from plugin "${plugin.name}":`;

      this.checkLegacyRoute(route, {
        controller,
        controllerNames,
        errorRoutePrefix,
        httpVerbs,
        routeProperties,
      });

      // @deprecated route.url is deprecated
      if (route.url) {
        plugin.printDeprecation(
          'Usage of "url" property for routes is deprecated. Use "path" instead.',
        );
      }
      route.path = route.path || route.url;

      debug(
        '[%s] binding HTTP route "%s" to controller "%s"',
        plugin.name,
        route.path,
        route.controller,
      );

      // @deprecated "/_plugin" prefix is deprecated for plugin routes
      this.routes.push({
        action: route.action,
        controller,
        path: `/_plugin/${plugin.name}${route.path}`,
        verb: route.verb,
      });

      const routePath =
        route.path.charAt(0) === "/"
          ? `/_${route.path}`
          : `/_/${plugin.name}/${route.path}`;

      this.routes.push({
        action: route.action,
        controller,
        path: routePath,
        verb: route.verb,
      });
    }
  }

  /**
   * Registers one action of the `api` object and answers the HTTP routes to
   * bind for it — the declared ones, or the single default route built from the
   * controller and action names.
   *
   * Lifted verbatim out of `_initApi` for the same gate reason as its siblings.
   */
  private registerApiAction(
    plugin: Plugin,
    controller: string,
    action: string,
    actionDefinition: JSONObject,
  ): JSONObject[] {
    let apiController = this.controllers.get(controller);

    if (!apiController) {
      apiController = new BaseController();
      this.controllers.set(controller, apiController);
    }

    let handler = actionDefinition.handler;

    // if the function handler is a plugin instance method,
    // bind the context to the plugin instance
    if (handler.name && typeof plugin.instance[handler.name] === "function") {
      handler = handler.bind(plugin.instance);
    }

    apiController._addAction(action, handler);

    const httpRoutes = actionDefinition.http || [];

    // Define default HTTP route if none have been provided
    if (httpRoutes.length === 0) {
      httpRoutes.push({
        path: `${Inflector.kebabCase(controller)}/${Inflector.kebabCase(action)}`,
        verb: "get",
      });
    }

    return httpRoutes;
  }

  /**
   * Checks one entry of the deprecated `routes` object: its properties, the
   * controller and action it names, and its HTTP verb.
   *
   * Lifted verbatim out of `_initControllers`, second half of the same
   * gate-driven split as `registerLegacyAction`.
   *
   * @throws {PluginImplementationError}
   */
  private checkLegacyRoute(
    route: JSONObject,
    names: {
      controller: string;
      controllerNames: string[];
      errorRoutePrefix: string;
      httpVerbs: string[];
      routeProperties: string[];
    },
  ): void {
    const {
      controller,
      controllerNames,
      errorRoutePrefix,
      httpVerbs,
      routeProperties,
    } = names;

    for (const key of Object.keys(route)) {
      if (!routeProperties.includes(key)) {
        throw controllerError.get(
          "unexpected_route_property",
          errorRoutePrefix,
          key,
          didYouMean(key, routeProperties),
        );
      }

      if (
        typeof route[key] !== "string" ||
        (route[key].length === 0 && key !== "url")
      ) {
        throw controllerError.get(
          "invalid_route_property",
          errorRoutePrefix,
          key,
        );
      }
    }

    const apiController = this.controllers.get(controller);

    if (!apiController) {
      throw controllerError.get(
        "undefined_controller",
        errorRoutePrefix,
        route.controller,
        didYouMean(route.controller, controllerNames),
      );
    }

    if (!apiController._isAction(route.action)) {
      const actionNames = Array.from(apiController._actions);
      throw controllerError.get(
        "undefined_action",
        errorRoutePrefix,
        route.action,
        didYouMean(route.action, actionNames),
      );
    }

    if (!httpVerbs.includes(route.verb.toLowerCase())) {
      throw controllerError.get(
        "unsupported_verb",
        errorRoutePrefix,
        httpVerbs.join(", "),
        didYouMean(route.verb, httpVerbs),
      );
    }
  }

  /**
   * Registers one action of the pre-Kaaf `controllers` object: a handler given
   * either as a function or as the name of a plugin method.
   *
   * Lifted verbatim out of `_initControllers`, whose cognitive complexity the
   * `.js` → `.ts` rename re-scored as new code.
   *
   * @throws {PluginImplementationError} when the target names nothing callable
   */
  private registerLegacyAction(
    plugin: Plugin,
    /**
     * Unvalidated: it arrives from the plugin's own `controllers` object, which
     * is `JSONObject`. The first check below is what makes the declared shape
     * true, and is the reason this parameter may claim it.
     */
    target: ControllerAction | string | undefined,
    names: {
      action: string;
      controller: string;
      controllerName: string;
      errorControllerPrefix: string;
    },
    methodsList: string[],
  ): void {
    const { action, controller, controllerName, errorControllerPrefix } = names;
    const named = typeof target === "string" ? target : null;

    if (
      typeof target !== "function" &&
      (named === null || typeof plugin.instance[named] !== "function")
    ) {
      const suggestion = named === null ? "" : didYouMean(named, methodsList);

      throw controllerError.get(
        "invalid_action",
        errorControllerPrefix,
        controller,
        action,
        suggestion,
      );
    }

    let apiController = this.controllers.get(controllerName);

    if (!apiController) {
      apiController = new BaseController();
      this.controllers.set(controllerName, apiController);
    }

    if (typeof target === "function") {
      apiController._addAction(action, target);
    } else {
      apiController._addAction(
        action,
        bindPluginMethod(plugin.instance, named),
      );
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initStrategies(plugin: Plugin): void {
    if (
      !isPlainObject(plugin.instance.strategies) ||
      isEmpty(plugin.instance.strategies)
    ) {
      throw strategyError.get("invalid_definition", plugin.logPrefix);
    }

    for (const name of Object.keys(plugin.instance.strategies)) {
      this.registerStrategy(
        plugin.name,
        name,
        plugin.instance.strategies[name],
      );
    }
  }

  /**
   * @param {object} plugin
   * @throws {PluginImplementationError} If strategies registration fails
   */
  _initAuthenticators(plugin: Plugin): void {
    if (!isPlainObject(plugin.instance.authenticators)) {
      throw kerror.get(
        "plugin",
        "authenticators",
        "not_an_object",
        plugin.logPrefix,
      );
    }

    for (const authenticator of Object.keys(plugin.instance.authenticators)) {
      if (!isConstructor(plugin.instance.authenticators[authenticator])) {
        throw kerror.get(
          "plugin",
          "authenticators",
          "invalid_authenticator",
          plugin.logPrefix,
          authenticator,
        );
      }
    }

    this.authenticators[plugin.name] = { ...plugin.instance.authenticators };
  }

  /**
   * Load detected plugins in memory
   *
   * @returns {object} list of loaded plugin
   */
  loadPlugins(plugins: JSONObject = {}): Map<string, Plugin> {
    const loadedPlugins = new Map();

    // first load plugins from Backend.plugin.use
    for (const [name, { plugin: instance, options }] of Object.entries(
      plugins,
    )) {
      const plugin = new Plugin(instance, { name, ...options });

      // the plugin cluster can be loaded in the startup script
      // and we need the manifest
      plugin.manifest = plugin.manifest || options.manifest;

      plugin.init(name);

      if (loadedPlugins.has(plugin.name)) {
        throw assertionError.get("name_already_exists", plugin.name);
      }

      loadedPlugins.set(plugin.name, plugin);
    }

    // then try to load plugins from the filesystem
    if (!fs.existsSync(this.pluginsEnabledDir)) {
      return loadedPlugins;
    }

    let pluginsPath = [];

    try {
      pluginsPath = fs
        .readdirSync(this.pluginsEnabledDir)
        .map((name) => path.join(this.pluginsEnabledDir, name))
        .filter((filePath) => fs.statSync(filePath).isDirectory());
    } catch (e) {
      throw assertionError.get(
        "invalid_plugins_dir",
        this.pluginsEnabledDir,
        e.message,
      );
    }

    debug("loading plugins: %a", pluginsPath);

    for (const relativePluginPath of pluginsPath) {
      const plugin = Plugin.loadFromDirectory(relativePluginPath);

      plugin.init(plugin.manifest.raw.name);

      if (loadedPlugins.has(plugin.name)) {
        throw assertionError.get("name_already_exists", plugin.name);
      }

      loadedPlugins.set(plugin.name, plugin);
    }

    return loadedPlugins;
  }

  /**
   * Wraps a strategy plugin's verify function.
   *
   * @param {String} pluginName
   * @param {String} strategyName
   * @param {Function} verifyMethod - Strategy plugin's verify method
   * @returns {Function}
   */
  wrapStrategyVerify(
    pluginName: string,
    strategyName: string,
    verifyMethod: PluginMethod,
  ): (...args: unknown[]) => Promise<unknown> {
    const prefix = `${pluginName} Strategy ${strategyName}:`;

    return async (...args: unknown[]) => {
      const callback = args.at(-1);

      // passport always calls the adapter with a trailing callback; the
      // narrowing is what lets it be invoked, and the branch cannot be taken.
      if (!isPluginMethod(callback)) {
        return;
      }

      const ret = verifyMethod(...args.slice(0, -1));

      // catching plugins returning non-thenable content
      // @todo - with async/await we might consider allowing non-promise results
      if (!isThenable(ret)) {
        callback(strategyError.get("invalid_verify_return", prefix, ret));
        return;
      }

      let result;

      try {
        result = await ret;
      } catch (e) {
        callback(e);
        return;
      }

      await resolveVerifiedUser(result, prefix, strategyName, callback);
    };
  }
}

/**
 * The duck-typed promise check `registerPipe` has always made: a plugin's pipe
 * may answer a promise, a value, or nothing, and only the first is awaited.
 * A guard rather than an inline `typeof` chain so the branch narrows.
 */
/**
 * Turns what a strategy's `verify` resolved into the passport callback call it
 * stands for: the authenticated user, an explicit refusal, or an error.
 *
 * Lifted verbatim out of `wrapStrategyVerify`, whose cognitive complexity the
 * `.js` → `.ts` rename re-scored as new code.
 */
async function resolveVerifiedUser(
  result: unknown,
  prefix: string,
  strategyName: string,
  callback: PluginMethod,
): Promise<void> {
  if (result === false) {
    callback(null, result, { message: null });
    return;
  }

  if (!isPlainObject(result)) {
    callback(strategyError.get("invalid_verify_resolve", prefix));
    return;
  }

  if (result.kuid !== null && result.kuid !== undefined) {
    if (typeof result.kuid === "string") {
      try {
        const user = await global.kuzzle.ask(
          "core:security:user:get",
          result.kuid,
        );

        callback(null, user);
      } catch (e) {
        if (e.id === "security.user.not_found") {
          callback(strategyError.get("unknown_kuid", prefix));
        } else {
          callback(e);
        }
      }

      return;
    }

    callback(strategyError.get("invalid_kuid", prefix, typeof result.kuid));
    return;
  }

  let message;
  if (result.message && typeof result.message === "string") {
    message = result.message;
  } else {
    message = `Unable to log in using the strategy "${strategyName}"`;
  }

  callback(null, false, { message });
}

/**
 * Resolves a handler a plugin referenced by name and binds it to the instance.
 *
 * `plugin.instance[name]` is `unknown` — a plugin may expose anything — so the
 * `typeof` check is what makes the result callable. Every call site had already
 * made that check; this is the same one, in the place that needs it.
 */
function bindPluginMethod(
  instance: PluginInstance,
  name: string,
): PluginMethod {
  const method = instance[name];

  if (!isPluginMethod(method)) {
    return undefined;
  }

  return method.bind(instance);
}

/**
 * A declared narrowing from `unknown` to "callable", the same shape
 * `safeObject.isPlainObject` has. A predicate rather than an assertion: it is
 * what lets a plugin's member — `unknown` by construction — be invoked without
 * an `as`, which TD-43's `casts` ratchet now prices.
 */
function isPluginMethod(value: unknown): value is PluginMethod {
  return typeof value === "function";
}

function isThenable(value: unknown): value is Bluebird<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function" &&
    "catch" in value &&
    typeof value.catch === "function"
  );
}

function isConstructor(arg: unknown): boolean {
  if (typeof arg !== "function") {
    return false;
  }

  try {
    Reflect.construct(Object, [], arg);
  } catch (e) {
    return false;
  }

  return true;
}

function getMethods(object: object): string[] {
  const prototype = Object.getPrototypeOf(object);

  const instanceMethods = Object.getOwnPropertyNames(prototype).filter(
    (method) => !["init", "constructor"].includes(method),
  );

  const objectMethods = Object.getOwnPropertyNames(object).filter(
    (key) => typeof object[key] === "function",
  );

  return [...instanceMethods, ...objectMethods];
}

export = PluginsManager;
