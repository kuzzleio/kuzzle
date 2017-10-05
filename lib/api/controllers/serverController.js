/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  Bluebird = require('bluebird'),
  os = require('os'),
  {
    ServiceUnavailableError,
    ExternalServiceError
  } = require('kuzzle-common-objects').errors;

/**
 * @class ServerController
 * @param {Kuzzle} kuzzle
 */
class ServerController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
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
        request.setError(new ServiceUnavailableError(error));
        result.services.internalCache = 'red';
        result.status = 'red';
      })
      .then(() => this.kuzzle.services.list.memoryStorage.getInfos())
      .then(() => {
        result.services.memoryStorage = 'green';
      })
      .catch(error => {
        request.setError(new ServiceUnavailableError(error));
        result.services.memoryStorage = 'red';
        result.status = 'red';
      })
      .then(() => this.kuzzle.services.list.storageEngine.getInfos())
      .then(response => {
        if (['yellow', 'green'].indexOf(response.status) < 0) {
          throw new ExternalServiceError('Elasticsearch is down: ' + JSON.stringify(response));
        }
        result.services.storageEngine = 'green';
      })
      .catch(error => {
        request.setError(new ServiceUnavailableError(error));
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

    ['controllers', 'pluginsControllers'].forEach(controllers => {
      let
        httpRoutes,
        urlPrefix;

      if (controllers === 'controllers') {
        httpRoutes = this.kuzzle.config.http.routes;
        urlPrefix = '';
      }
      else {
        httpRoutes = this.kuzzle.pluginsManager.routes;
        urlPrefix = '_plugin/';
      }

      Object.keys(this.kuzzle.funnel[controllers]).forEach(controller => {
        const actionList = {};
        const properties = [];

        // Plugins controllers can never be ES6 classes
        if (controllers === 'controllers') {
          properties.push(...Object.getOwnPropertyNames(Object.getPrototypeOf(this.kuzzle.funnel[controllers][controller]))
            .filter(p => p !== 'constructor'));
        }

        properties.push(...Object.keys(this.kuzzle.funnel[controllers][controller])
          .filter(p => this.kuzzle.funnel[controllers][controller].hasOwnProperty(p)));

        properties.forEach(action => {
          // we exclude action names starting with an underscore,
          // as this is the usual way to name a private method
          if (action[0] !== '_' && typeof this.kuzzle.funnel[controllers][controller][action] === 'function') {
            actionList[action] = {controller, action};

            // resolve associated http route for each actions
            const routeDescription = httpRoutes.find(route => {
              return (
                (route.controller === controller || controller === 'memoryStorage' && route.controller === 'ms') &&
                route.action === action
              );
            });

            if (routeDescription) {
              actionList[action].http = {
                url: (urlPrefix + routeDescription.url).replace(/\/\//g, '/'),
                verb: routeDescription.verb.toUpperCase()
              };
            }
          }
        });

        if (Object.keys(actionList).length > 0) {
          response.kuzzle.api.routes[controller] = actionList;
        }
      });
    });

    response.kuzzle.plugins = this.kuzzle.pluginsManager.getPluginsDescription();

    let serviceName;

    return Object.keys(this.kuzzle.services.list).reduce((previous, current) => {
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
}

module.exports = ServerController;
