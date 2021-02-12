/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

'use strict';

const kerror = require('../../kerror');
const { NativeController } = require('./baseController');
const os = require('os');
const generateOpenApi = require('../openApiGenerator');
const jsonToYaml = require('json2yaml');

/**
 * @class ServerController
 */
class ServerController extends NativeController {
  constructor() {
    super([
      'adminExists',
      'getAllStats',
      'getConfig',
      'getLastStats',
      'getStats',
      'healthCheck',
      'info',
      'now',
      'publicApi',
      'openapi'
    ]);
  }

  /**
   * Returns the statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getStats (request) {
    return global.kuzzle.statistics.getStats(request);
  }

  /**
   * Returns the last statistics frame
   *
   * @returns {Promise<Object>}
   */
  getLastStats () {
    return global.kuzzle.statistics.getLastStats();
  }

  /**
   * Returns all stored statistics frames
   *
   * @returns {Promise<Object>}
   */
  getAllStats () {
    return global.kuzzle.statistics.getAllStats();
  }

  /**
   * Returns the Kuzzle configuration
   *
   * @returns {Promise<Object>}
   */
  async getConfig () {
    const config = Object.assign({}, global.kuzzle.config);

    // Already and more appropriately returned by server:info
    config.http = undefined;

    // Not a good idea to export Kuzzle's salt, hash algorithm
    // and default rights
    config.security = undefined;

    if (config.VAULT_KEY) {
      config.VAULT_KEY = undefined;
    }

    return config;
  }

  /**
   * Checks if an admin user Exists
   *
   * @returns {Promise<Object>}
   */
  async adminExists () {
    const exists = await global.kuzzle.ask('core:security:user:admin:exist');

    return { exists };
  }

  /**
   * @returns {Promise<Object>}
   */
  async now () {
    return { now: Date.now() };
  }

  /**
   * @returns {Promise<Object>}
   */
  async healthCheck (request) {
    const getServiceUnavailableError =
      err => kerror.get('core', 'fatal', 'service_unavailable', err);
    const result = { services: {}, status: 'green' };

    let services;
    if (typeof request.input.args.services === 'string') {
      services = request.input.args.services.split(',');
    }
    if (!services || services.includes('internalCache')) {
      try {
        await global.kuzzle.ask('core:cache:internal:info:get');
        result.services.internalCache = 'green';
      }
      catch (error) {
        request.setError(getServiceUnavailableError(error));
        result.services.internalCache = 'red';
        result.status = 'red';
      }
    }
    if (!services || services.includes('memoryStorage')) {
      try {
        await global.kuzzle.ask('core:cache:public:info:get');
        result.services.memoryStorage = 'green';
      }
      catch (error) {
        request.setError(getServiceUnavailableError(error));
        result.services.memoryStorage = 'red';
        result.status = 'red';
      }
    }
    if (!services || services.includes('storageEngine')) {
      try {
        const response = await global.kuzzle.ask('core:storage:public:info:get');

        if (response.status !== 'yellow' && response.status !== 'green') {
          throw new Error(`ElasticSearch is down: ${JSON.stringify(response)}`);
        }

        result.services.storageEngine = 'green';
      }
      catch (error) {
        request.setError(getServiceUnavailableError(error));
        result.services.storageEngine = 'red';
        result.status = 'red';
      }
    }
    return result;
  }

  /**
   * @returns {Promise<Object>}
   */
  async info () {
    const response = {
      kuzzle: {
        api: {
          routes: {}
        },
        application: {},
        memoryUsed: process.memoryUsage().rss,
        nodeVersion: process.version,
        plugins: {},
        system: {
          cpus: os.cpus(),
          memory: {
            free: os.freemem(),
            total: os.totalmem()
          }
        },
        uptime: `${process.uptime()}s`,
        version: global.kuzzle.config.version
      },
      services: {}
    };

    const kuzzleApi = this._buildApiDefinition(
      global.kuzzle.funnel.controllers,
      global.kuzzle.config.http.routes);
    const pluginsApi = this._buildApiDefinition(
      global.kuzzle.pluginsManager.controllers,
      global.kuzzle.pluginsManager.routes);
    const apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    // @todo kuzzle.api should contain the apiDefinition directly
    response.kuzzle.api.routes = apiDefinition;

    response.kuzzle.plugins = global.kuzzle.pluginsManager.getPluginsDescription();

    response.kuzzle.application = global.kuzzle.pluginsManager.application.info();

    response.services = {
      internalCache: await global.kuzzle.ask('core:cache:internal:info:get'),
      internalStorage: await global.kuzzle.ask('core:storage:private:info:get'),
      memoryStorage: await global.kuzzle.ask('core:cache:public:info:get'),
      publicStorage: await global.kuzzle.ask('core:storage:public:info:get'),
    };

    return {
      serverInfo: response
    };
  }

  async publicApi () {
    const
      kuzzleApi = this._buildApiDefinition(
        global.kuzzle.funnel.controllers,
        global.kuzzle.config.http.routes),
      pluginsApi = this._buildApiDefinition(
        global.kuzzle.pluginsManager.controllers,
        global.kuzzle.pluginsManager.routes),
      apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    return apiDefinition;
  }

  async openapi (request) {
    const format = request.input.args.format
      ? request.input.args.format
      : 'json';
    const contentType = format === 'yaml'
      ? 'application/yaml'
      : 'application/json';
    const specifications = format === 'yaml'
      ? jsonToYaml.stringify(generateOpenApi())
      : generateOpenApi();

    request.setResult(specifications, {
      headers: { 'Content-Type': contentType },
      raw: true,
      status: 200
    });

    return specifications;
  }

  _buildApiDefinition (controllers, httpRoutes) {
    const apiDefinition = {};

    for (const [ name, controller ] of controllers.entries()) {
      const actionList = {};

      for (const action of controller._actions) {
        actionList[action] = { action , controller: name };

        // resolve associated http route for each actions
        const routes = httpRoutes.filter(route => {
          return (
            (route.controller === name
              || (name === 'memoryStorage' && route.controller === 'ms'))
            && route.action === action);
        });

        for (const route of routes) {
          if (! actionList[action].http) {
            actionList[action].http = [];
          }

          actionList[action].http.push({
            path: route.path,
            url: route.path,
            verb: route.verb.toUpperCase()
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
