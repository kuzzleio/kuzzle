var
  Promise = require('bluebird'),
  os = require('os'),
  _ = require('lodash'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function ReadController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  this.search = function readSearch (requestObject) {
    var modifiedRequestObject = null;

    return new Promise((resolve, reject) => {
      if (requestObject.index && typeof requestObject.index === 'string' && requestObject.index.split(',').length > 1) {
        return reject(new BadRequestError('Search on multiple indexes is not available.'));
      }

      resolve({});
    })
      .then(() => {
        return kuzzle.pluginsManager.trigger('data:beforeSearch', requestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.search(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSearch', new ResponseObject(modifiedRequestObject, response)));
  };

  this.get = function readGet (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGet', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.get(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGet', new ResponseObject(modifiedRequestObject, response)));
  };

  this.count = function readCount (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeCount', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.count(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterCount', new ResponseObject(requestObject, response)));
  };

  this.listCollections = function readListCollections (requestObject) {
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections = [],
      modifiedRequestObject = null;

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return Promise.reject(
        new ResponseObject(requestObject, new BadRequestError('listCollections: unrecognized type argument: "' + type + '"'))
      );
    }

    return kuzzle.pluginsManager.trigger('data:beforeListCollections', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (type === 'stored') {
          return engine.listCollections(modifiedRequestObject)
            .then(response => {
              response.type = type;
              return kuzzle.pluginsManager.trigger('data:afterListCollections', new ResponseObject(modifiedRequestObject, response));
            });
        }

        realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections()
          .filter(collection => collection.index === requestObject.index)
          .map(collection => collection.name);

        if (type === 'realtime') {
          return kuzzle.pluginsManager.trigger('data:afterListCollections', new ResponseObject(modifiedRequestObject, {type, collections: {realtime: realtimeCollections}}));
        }

        return engine.listCollections(modifiedRequestObject)
          .then(response => {
            var responseObject = new ResponseObject(modifiedRequestObject, response);

            responseObject.data.body.type = type;
            responseObject.data.body.collections.realtime = realtimeCollections;
            return kuzzle.pluginsManager.trigger('data:afterListCollections', responseObject);
          });
      });
  };

  this.now = function readNow (requestObject) {
    return kuzzle.pluginsManager.trigger('data:beforeNow', requestObject)
      .then(newRequestObject => kuzzle.pluginsManager.trigger('data:afterNow', new ResponseObject(newRequestObject, {now: Date.now()})));
  };

  this.listIndexes = function readListIndexes (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeListIndexes', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.listIndexes(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterListIndexes', new ResponseObject(modifiedRequestObject, response)));
  };

  this.serverInfo = function readServerInfo (requestObject) {
    var
      serviceName,
      response = {
        kuzzle: {
          version: kuzzle.config.version,
          api: {
            version: kuzzle.config.apiVersion,
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
          Object.keys(kuzzle.config.httpRoutes).forEach((key) => {
            var route = kuzzle.config.httpRoutes[key];

            if ((route.controller === controller || controller === 'memoryStorage' && route.controller === 'ms') && route.action === action) {
              routeDescription = route;
              return false;
            }
          });

          if (routeDescription.url) {
            actionList[action].route = '/api/' + kuzzle.config.apiVersion + routeDescription.url;
            actionList[action].method = routeDescription.verb;
          }
        }
      });

      if (Object.keys(actionList).length > 0) {
        response.kuzzle.api.routes[controller] = actionList;
      }
    });

    Object.keys(kuzzle.pluginsManager.plugins).forEach(plugin => {
      var
        pluginInfo = kuzzle.pluginsManager.plugins[plugin],
        p = {
          name: pluginInfo.name,
          version: pluginInfo.version,
          activated: pluginInfo.activated,
          hooks: [],
          pipes: [],
          controllers: [],
          routes: []
        };

      if (pluginInfo.object.hasOwnProperty('hooks')) {
        p.hooks = _.uniq(Object.keys(pluginInfo.object.hooks));
      }

      if (pluginInfo.object.hasOwnProperty('pipes')) {
        p.pipes = _.uniq(Object.keys(pluginInfo.object.pipes));
      }

      if (pluginInfo.object.hasOwnProperty('controllers')) {
        p.controllers = _.uniq(Object.keys(pluginInfo.object.controllers));
        p.controllers = p.controllers.map((item) => pluginInfo.name + '/' + item);
      }

      if (pluginInfo.object.hasOwnProperty('routes')) {
        p.routes = _.uniq(pluginInfo.object.routes);
      }

      response.kuzzle.plugins[plugin] = p;
    });

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

      return kuzzle.pluginsManager.trigger('data:afterServerInfo', new ResponseObject(requestObject, {serverInfo: response}));
    });
  };
}

module.exports = ReadController;
