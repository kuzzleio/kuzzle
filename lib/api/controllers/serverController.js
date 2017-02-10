'use strict';

var
  _ = require('lodash'),
  Promise = require('bluebird'),
  os = require('os');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function ServerController (kuzzle) {
  /**
   * Returns the statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getStats = function serverGetStats (request) {
    return kuzzle.statistics.getStats(request);
  };

  /**
   * Returns the last statistics frame
   *
   * @returns {Promise<Object>}
   */
  this.getLastStats = function serverGetLastStats () {
    return kuzzle.statistics.getLastStats();
  };

  /**
   * Returns all stored statistics frames
   *
   * @returns {Promise<Object>}
   */
  this.getAllStats = function serverGetAllStats () {
    return kuzzle.statistics.getAllStats();
  };

  /**
   * Returns the Kuzzle configuration
   *
   * @returns {Promise<Object>}
   */
  this.getConfig = function serverGetConfig () {
    var pluginsConfig = {};

    const promises = Object.keys(kuzzle.pluginsManager.plugins).map(id => {
      return kuzzle.internalEngine.get('plugins', id);
    });

    return Promise.all(promises)
      .then(responses => {
        responses.forEach(entry => {
          pluginsConfig[entry._id] = entry._source;
        });
        return {
          kuzzle: _.assignIn({}, kuzzle.config),
          plugins: {
            config: pluginsConfig,
            routes: _.assignIn([], kuzzle.pluginsManager.routes)
          }
        };
      });
  };

  /**
   * Checks if an admin user Exists
   *
   * @returns {Promise<Object>}
   */
  this.adminExists = function serverAdminExists () {
    return kuzzle.internalEngine.bootstrap.adminExists()
      .then((response) => Promise.resolve({exists: response}));
  };

  /**
   * @returns {Promise<Object>}
   */
  this.now = function serverNow () {
    return Promise.resolve({now: Date.now()});
  };

  /**
   * @returns {Promise<Object>}
   */
  this.info = function serverInfo () {
    var
      serviceName,
      response = {
        kuzzle: {
          version: kuzzle.config.version,
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

    Object.keys(kuzzle.funnel.controllers).forEach(controller => {
      var actionList = {};

      Object.keys(kuzzle.funnel.controllers[controller]).forEach(action => {
        var routeDescription = {};

        if (typeof kuzzle.funnel.controllers[controller][action] === 'function') {
          actionList[action] = {name: action};

          // resolve associated http route for each actions
          Object.keys(kuzzle.config.http.routes).forEach((key) => {
            var route = kuzzle.config.http.routes[key];

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

    response.kuzzle.plugins = kuzzle.pluginsManager.getPluginsFeatures();

    return Object.keys(kuzzle.services.list).reduce((previous, current) => {
      return previous.then(serviceInfo => {
        if (serviceInfo) {
          response.services[serviceName] = serviceInfo;
        }

        serviceName = current;

        if (kuzzle.services.list[current].getInfos) {
          return kuzzle.services.list[current].getInfos();
        }

        return Promise.resolve();
      });
    }, Promise.resolve())
      .then(serviceInfo => {
        if (serviceInfo) {
          response.services[serviceName] = serviceInfo;
        }

        return Promise.resolve({serverInfo: response});
      });
  };
}

module.exports = ServerController;
