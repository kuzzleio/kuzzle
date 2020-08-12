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

const
  kerror = require('../../kerror'),
  { NativeController } = require('./base'),
  os = require('os');

/**
 * @class ServerController
 * @param {Kuzzle} kuzzle
 */
class ServerController extends NativeController {
  constructor(kuzzle) {
    super(kuzzle, [
      'adminExists',
      'getAllStats',
      'getConfig',
      'getLastStats',
      'getStats',
      'healthCheck',
      'info',
      'now',
      'publicApi'
    ]);
  }

  /**
   * Returns the statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getStats (request) {
    return this.kuzzle.statistics.getStats(request);
  }

  /**
   * Returns the last statistics frame
   *
   * @returns {Promise<Object>}
   */
  getLastStats () {
    return this.kuzzle.statistics.getLastStats();
  }

  /**
   * Returns all stored statistics frames
   *
   * @returns {Promise<Object>}
   */
  getAllStats () {
    return this.kuzzle.statistics.getAllStats();
  }

  /**
   * Returns the Kuzzle configuration
   *
   * @returns {Promise<Object>}
   */
  async getConfig () {
    const config = Object.assign({}, this.kuzzle.config);

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
    const exists = await this.kuzzle.ask('core:security:user:admin:exist');

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
    const
      getServiceUnavailableError =
        err => kerror.get('core', 'fatal', 'service_unavailable', err),
      result = { services: {}, status: 'green' };

    let services;
    if (typeof request.input.args.services === 'string') {
      services = request.input.args.services.split(',');
    }
    if (!services || services.includes('internalCache')) {
      try {
        await this.kuzzle.cacheEngine.internal.info();
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
        await this.kuzzle.cacheEngine.public.info();
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
        const response = await this.kuzzle.storageEngine.public.info();

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
        version: this.kuzzle.config.version
      },
      services: {}
    };

    const kuzzleApi = this._buildApiDefinition(
      this.kuzzle.funnel.controllers,
      this.kuzzle.config.http.routes);
    const pluginsApi = this._buildApiDefinition(
      this.kuzzle.pluginsManager.controllers,
      this.kuzzle.pluginsManager.routes);
    const apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    // @todo kuzzle.api should contain the apiDefinition directly
    response.kuzzle.api.routes = apiDefinition;

    response.kuzzle.plugins = this.kuzzle.pluginsManager.getPluginsDescription();

    response.kuzzle.application = this.kuzzle.pluginsManager.application.info();

    response.services.internalCache = await this.kuzzle.cacheEngine.internal.info();

    response.services.memoryStorage = await this.kuzzle.cacheEngine.public.info();

    response.services.internalStorage = await this.kuzzle.storageEngine.internal.info();

    response.services.publicStorage = await this.kuzzle.storageEngine.public.info();

    return {
      serverInfo: response
    };
  }

  async publicApi () {
    const
      kuzzleApi = this._buildApiDefinition(
        this.kuzzle.funnel.controllers,
        this.kuzzle.config.http.routes),
      pluginsApi = this._buildApiDefinition(
        this.kuzzle.pluginsManager.controllers,
        this.kuzzle.pluginsManager.routes),
      apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    return apiDefinition;
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
