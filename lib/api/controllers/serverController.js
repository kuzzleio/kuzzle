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

"use strict";

const os = require("os");
const jsonToYaml = require("json2yaml");
const packagejson = require("../../../package.json");

const { NativeController } = require("./baseController");

const kerror = require("../../kerror");

/**
 * @class ServerController
 */
class ServerController extends NativeController {
  constructor() {
    super([
      "adminExists",
      "capabilities",
      "getAllStats",
      "getConfig",
      "getLastStats",
      "getStats",
      "healthCheck",
      "info",
      "metrics",
      "now",
      "publicApi",
      "openapi",
    ]);

    this._info = {
      elasticsearch: null,
      redis: null,
    };
  }

  /**
   * Init ServerController
   * Used to perform asynchronous initialization safely: the funnel will wait
   * for all controllers to be initialized before accepting requests.
   *
   * @returns {Promise}
   */
  async init() {
    const [storageInfo, cacheInfo] = await Promise.all([
      global.kuzzle.ask("core:storage:public:info:get"),
      global.kuzzle.ask("core:cache:public:info:get"),
    ]);
    this._info.elasticsearch = storageInfo;
    this._info.redis = cacheInfo;
  }

  /**
   * Returns the statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   *
   * @deprecated
   */
  getStats(request) {
    return global.kuzzle.statistics.getStats(request);
  }

  /**
   * Returns the last statistics frame
   *
   * @returns {Promise<Object>}
   *
   * @deprecated
   */
  getLastStats() {
    return global.kuzzle.statistics.getLastStats();
  }

  /**
   * Returns all stored statistics frames
   *
   * @returns {Promise<Object>}
   *
   * @deprecated
   */
  getAllStats() {
    return global.kuzzle.statistics.getAllStats();
  }

  /**
   * Returns the Kuzzle configuration
   *
   * @returns {Promise<Object>}
   */
  async getConfig() {
    const config = JSON.parse(JSON.stringify(global.kuzzle.config));

    // Already and more appropriately returned by server:info
    config.http.routes = undefined;

    // Not a good idea to export Kuzzle's salt, hash algorithm
    // and default rights
    config.security = undefined;

    if (config.VAULT_KEY) {
      config.VAULT_KEY = undefined;
    }

    return config;
  }

  /**
   * Returns the Kuzzle capabilities
   * @returns {Promise<Object>}
   */
  async capabilities() {
    const config = JSON.parse(JSON.stringify(global.kuzzle.config));
    const publicApi = await this.publicApi();
    const services = {};
    const plugins = {};

    for (const plugin of config.plugins.common.include) {
      plugins[plugin] = {
        version: packagejson.dependencies[plugin],
      };
    }

    for (const [name, info] of Object.entries(config.services)) {
      if (info.backend !== undefined) {
        services[name] = {
          backend: info.backend,
          version: this._info[info.backend].version,
        };
      }
    }

    return {
      limits: config.limits,
      plugins: plugins,
      routes: publicApi,
      services: services,
      version: config.version,
    };
  }
  /**
   * Checks if an admin user Exists
   *
   * @returns {Promise<Object>}
   */
  async adminExists() {
    const exists = await global.kuzzle.ask("core:security:user:admin:exist");

    return { exists };
  }

  /**
   * @returns {Promise<Object>}
   */
  async now() {
    return { now: Date.now() };
  }

  /**
   * @returns {Promise<Object>}
   */
  async healthCheck(request) {
    const getServiceUnavailableError = (err) =>
      kerror.get("core", "fatal", "service_unavailable", err);
    const result = { services: {}, status: "green" };

    let services;
    if (typeof request.input.args.services === "string") {
      // @deprecated Should be replaced with request.getArray('services')
      services = request.getArrayLegacy("services");
    }
    if (!services || services.includes("internalCache")) {
      try {
        await global.kuzzle.ask("core:cache:internal:info:get");
        result.services.internalCache = "green";
      } catch (error) {
        request.setError(getServiceUnavailableError(error));
        result.services.internalCache = "red";
        result.status = "red";
      }
    }
    if (!services || services.includes("memoryStorage")) {
      try {
        await global.kuzzle.ask("core:cache:public:info:get");
        result.services.memoryStorage = "green";
      } catch (error) {
        request.setError(getServiceUnavailableError(error));
        result.services.memoryStorage = "red";
        result.status = "red";
      }
    }
    if (!services || services.includes("storageEngine")) {
      try {
        const response = await global.kuzzle.ask(
          "core:storage:public:info:get"
        );

        if (response.status !== "yellow" && response.status !== "green") {
          throw new Error(`ElasticSearch is down: ${JSON.stringify(response)}`);
        }

        result.services.storageEngine = "green";
      } catch (error) {
        request.setError(getServiceUnavailableError(error));
        result.services.storageEngine = "red";
        result.status = "red";
      }
    }
    return result;
  }

  /**
   * @returns {Promise<Object>}
   */
  async info() {
    const response = {
      kuzzle: {
        api: {
          routes: {},
        },
        application: {},
        memoryUsed: process.memoryUsage().rss,
        nodeVersion: process.version,
        plugins: {},
        system: {
          cpus: os.cpus(),
          memory: {
            free: os.freemem(),
            total: os.totalmem(),
          },
        },
        uptime: `${process.uptime()}s`,
        version: global.kuzzle.config.version,
      },
      services: {},
    };

    const kuzzleApi = this._buildApiDefinition(
      global.kuzzle.funnel.controllers,
      global.kuzzle.config.http.routes
    );
    const pluginsApi = this._buildApiDefinition(
      global.kuzzle.pluginsManager.controllers,
      global.kuzzle.pluginsManager.routes
    );
    const apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    // @todo kuzzle.api should contain the apiDefinition directly
    response.kuzzle.api.routes = apiDefinition;

    response.kuzzle.plugins =
      global.kuzzle.pluginsManager.getPluginsDescription();

    response.kuzzle.application =
      global.kuzzle.pluginsManager.application.info();

    response.services = {
      internalCache: await global.kuzzle.ask("core:cache:internal:info:get"),
      internalStorage: await global.kuzzle.ask("core:storage:private:info:get"),
      memoryStorage: await global.kuzzle.ask("core:cache:public:info:get"),
      publicStorage: await global.kuzzle.ask("core:storage:public:info:get"),
    };

    return {
      serverInfo: response,
    };
  }

  async publicApi() {
    const kuzzleApi = this._buildApiDefinition(
      global.kuzzle.funnel.controllers,
      global.kuzzle.config.http.routes
    );
    const pluginsApi = this._buildApiDefinition(
      global.kuzzle.pluginsManager.controllers,
      global.kuzzle.pluginsManager.routes
    );

    return { ...kuzzleApi, ...pluginsApi };
  }

  async openapi(request) {
    const format = request.getString("format", "json");
    const scope = request.getString("scope", "kuzzle");

    let definition;

    if (scope === "kuzzle") {
      definition = await global.kuzzle.ask("core:api:openapi:kuzzle");
    } else if (scope === "app") {
      definition = await global.kuzzle.ask("core:api:openapi:app");
    } else {
      throw kerror.get("api", "assert", "unexpected_argument", scope, [
        "kuzzle",
        "app",
      ]);
    }

    request.response.configure({
      format: "raw",
      headers: { "Content-Type": `application/${format}` },
    });

    return format === "json" ? definition : jsonToYaml.stringify(definition);
  }

  /**
   * Fetches and returns Kuzzle core metrics
   * @returns {Promise<Object>}
   */
  async metrics() {
    return {
      api: await global.kuzzle.ask("kuzzle:api:funnel:metrics"),
      network: await global.kuzzle.ask("core:network:router:metrics"),
      realtime: await global.kuzzle.ask("core:realtime:hotelClerk:metrics"),
    };
  }

  _buildApiDefinition(controllers, httpRoutes) {
    const apiDefinition = {};

    for (const [name, controller] of controllers.entries()) {
      const actionList = {};

      for (const action of controller._actions) {
        actionList[action] = { action, controller: name };

        // resolve associated http route for each actions
        const routes = httpRoutes.filter((route) => {
          return (
            (route.controller === name ||
              (name === "memoryStorage" && route.controller === "ms")) &&
            route.action === action
          );
        });

        for (const route of routes) {
          if (!actionList[action].http) {
            actionList[action].http = [];
          }

          actionList[action].http.push({
            path: route.path,
            url: route.path,
            verb: route.verb.toUpperCase(),
          });
        }
      }

      if (Object.keys(actionList).length > 0) {
        apiDefinition[name] = actionList;
      }
    }

    return apiDefinition;
  }
}

module.exports = ServerController;
