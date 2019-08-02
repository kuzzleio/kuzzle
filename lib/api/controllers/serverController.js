/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  BaseController = require('./baseController'),
  Bluebird = require('bluebird'),
  os = require('os');

/**
 * @class ServerController
 * @param {Kuzzle} kuzzle
 */
class ServerController extends BaseController {
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

    this.subdomain = 'server';
  }

  /**
   * Returns the statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getStats(request) {
    return this.kuzzle.statistics.getStats(request);
  }

  /**
   * Returns the last statistics frame
   *
   * @returns {Promise<Object>}
   */
  getLastStats() {
    return this.kuzzle.statistics.getLastStats();
  }

  /**
   * Returns all stored statistics frames
   *
   * @returns {Promise<Object>}
   */
  getAllStats() {
    return this.kuzzle.statistics.getAllStats();
  }

  /**
   * Returns the Kuzzle configuration
   *
   * @returns {Promise<Object>}
   */
  getConfig() {
    const config = Object.assign({}, this.kuzzle.config);

    // Already and more appropriately returned by server:info
    delete config.http;

    // Not a good idea to export Kuzzle's salt, hash algorithm
    // and default rights
    delete config.security;

    return Bluebird.resolve(config);
  }

  /**
   * Checks if an admin user Exists
   *
   * @returns {Promise<Object>}
   */
  adminExists() {
    return this.kuzzle.internalEngine.bootstrap.adminExists()
      .then(response => Bluebird.resolve({exists: response}));
  }

  /**
   * @returns {Promise<Object>}
   */
  now() {
    return Bluebird.resolve({now: Date.now()});
  }

  /**
   * @returns {Promise<Object>}
   */
  healthCheck(request) {
    const result = {
      status: 'green',
      services: {}
    };

    return this.kuzzle.services.list.internalCache.getInfos()
      .then(() => {
        result.services.internalCache = 'green';
      })
      .catch(error => {
        request.setError(this.getError(
          'internal',
          'external_services',
          'service_unavailable',
          error));
        result.services.internalCache = 'red';
        result.status = 'red';
      })
      .then(() => this.kuzzle.services.list.memoryStorage.getInfos())
      .then(() => {
        result.services.memoryStorage = 'green';
      })
      .catch(error => {
        request.setError(this.getError(
          'internal',
          'external_services',
          'service_unavailable',
          error));
        result.services.memoryStorage = 'red';
        result.status = 'red';
      })
      .then(() => this.kuzzle.services.list.storageEngine.getInfos())
      .then(response => {
        if (['yellow', 'green'].indexOf(response.status) === -1) {
          this.throw('elasticsearch_down', JSON.stringify(response));
        }
        result.services.storageEngine = 'green';
      })
      .catch(error => {
        request.setError(this.getError(
          'internal',
          'external_services',
          'service_unavailable',
          error));
        result.services.storageEngine = 'red';
        result.status = 'red';
      })
      .then(() => result);
  }

  /**
   * @returns {Promise<Object>}
   */
  info() {
    const
      response = {
        kuzzle: {
          version: this.kuzzle.config.version,
          api: {
            routes: {}
          },
          nodeVersion: process.version,
          memoryUsed: process.memoryUsage().rss,
          uptime: process.uptime() + 's',
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
        this.kuzzle.funnel.pluginsControllers,
        this.kuzzle.pluginsManager.routes,
        '_plugin/'),
      apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    response.kuzzle.api.routes = apiDefinition;

    response.kuzzle.plugins =
      this.kuzzle.pluginsManager.getPluginsDescription();

    let serviceName;

    return Object.keys(
      this.kuzzle.services.list).reduce((previous, current) => {
      return previous.then(serviceInfo => {
        if (serviceName && serviceInfo) {
          response.services[serviceName] = serviceInfo;
        }

        serviceName = current;

        if (this.kuzzle.services.list[current].getInfos) {
          return this.kuzzle.services.list[current].getInfos();
        }

        return Bluebird.resolve();
      });
    }, Bluebird.resolve())
      .then(serviceInfo => {
        if (serviceInfo) {
          response.services[serviceName] = serviceInfo;
        }

        return Bluebird.resolve({serverInfo: response});
      });
  }

  publicApi () {
    const
      kuzzleApi = this._buildApiDefinition(
        this.kuzzle.funnel.controllers,
        this.kuzzle.config.http.routes),
      pluginsApi = this._buildApiDefinition(
        this.kuzzle.funnel.pluginsControllers,
        this.kuzzle.pluginsManager.routes,
        '_plugin/'),
      apiDefinition = Object.assign({}, kuzzleApi, pluginsApi);

    return Bluebird.resolve(apiDefinition);
  }

  _buildApiDefinition (controllers, httpRoutes, urlPrefix = '') {
    const routes = {};

    for (const controller of Object.keys(controllers)) {
      const actionList = {};

      for (const action of this._getActions(controllers[controller])) {
        actionList[action] = { controller, action };

        // resolve associated http route for each actions
        const routeDescriptionList = httpRoutes.filter(route => {
          return ((
            route.controller === controller
              || (controller === 'memoryStorage' && route.controller === 'ms'))
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
        routes[controller] = actionList;
      }
    }

    return routes;
  }

  _getActions (controller) {
    if (controller.actions instanceof Set) {
      return controller.actions;
    }

    // plugin controller does not have "actions" array
    return Object.keys(controller);
  }
}

module.exports = ServerController;
