/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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
  os = require('os');

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

    Object.keys(this.kuzzle.funnel.controllers).forEach(controller => {
      const actionList = {};

      Object.keys(this.kuzzle.funnel.controllers[controller]).forEach(action => {
        let routeDescription = {};

        if (typeof this.kuzzle.funnel.controllers[controller][action] === 'function') {
          actionList[action] = {name: action};

          // resolve associated http route for each actions
          Object.keys(this.kuzzle.config.http.routes).forEach(key => {
            const route = this.kuzzle.config.http.routes[key];

            if ((route.controller === controller || controller === 'memoryStorage' && route.controller === 'ms') && route.action === action) {
              routeDescription = route;
              return false;
            }
          });

          if (routeDescription.url) {
            actionList[action].route = routeDescription.url;
            actionList[action].method = routeDescription.verb;
          }
        }
      });

      if (Object.keys(actionList).length > 0) {
        response.kuzzle.api.routes[controller] = actionList;
      }
    });

    response.kuzzle.plugins = this.kuzzle.pluginsManager.getPluginsFeatures();

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
