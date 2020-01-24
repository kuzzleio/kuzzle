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
  errorsManager = require('../../util/errors'),
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
    const exists = await this.kuzzle.adminExists();

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
        err => errorsManager.get('core', 'fatal', 'service_unavailable', err),
      result = { status: 'green', services: {} };

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
    const
      response = {
        kuzzle: {
          version: this.kuzzle.config.version,
          api: {
            routes: {}
          },
          nodeVersion: process.version,
          memoryUsed: process.memoryUsage().rss,
          uptime: `${process.uptime()}s`,
          plugins: {},
          system: {
            memory: {
              total: os.totalmem(),
              free: os.freemem()
            },
            cpus: os.cpus()
          }
        },
        services: {}
      };

    const
      kuzzleApi = this._buildApiDefinition(
        this.kuzzle.funnel.controllers,
        this.kuzzle.config.http.routes),
      pluginsApi = this._buildApiDefinition(
        this.kuzzle.pluginsManager.controllers,
        this.kuzzle.pluginsManager.routes,
        '_plugin/'),
      apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    response.kuzzle.api.routes = apiDefinition;

    response.kuzzle.plugins = this.kuzzle.pluginsManager.getPluginsDescription();

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
        this.kuzzle.pluginsManager.routes,
        '_plugin/'),
      apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    return apiDefinition;
  }

  _buildApiDefinition (controllers, httpRoutes, urlPrefix = '') {
    const routes = {};

    for (const [ name, controller ] of controllers.entries()) {
      const actionList = {};

      for (const action of controller._actions) {
        actionList[action] = { controller: name , action };

        // resolve associated http route for each actions
        const routeDescriptionList = httpRoutes.filter(route => {
          return (
            (route.controller === name
              || (name === 'memoryStorage' && route.controller === 'ms'))
            && route.action === action);
        });

        for (const routeDescription of routeDescriptionList) {
          if (! actionList[action].http) {
            actionList[action].http = [];
          }

          actionList[action].http.push({
            url: (urlPrefix + routeDescription.url).replace(/\/\//g, '/'),
            verb: routeDescription.verb.toUpperCase()
          });
        }
      }

      if (Object.keys(actionList).length > 0) {
        routes[name] = actionList;
      }
    }

    return routes;
  }
}

module.exports = ServerController;
