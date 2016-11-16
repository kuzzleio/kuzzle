'use strict';
var
  Promise = require('bluebird'),
  os = require('os'),
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

    if (requestObject.index && typeof requestObject.index === 'string' && requestObject.index.split(',').length > 1) {
      return Promise.reject(new BadRequestError('Search on multiple indexes is not available.'));
    }

    return kuzzle.pluginsManager.trigger('data:beforeSearch', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.search(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSearch', new ResponseObject(modifiedRequestObject, response)));
  };

  this.scroll = function readScroll (requestObject) {
    var modifiedRequestObject = null;

    if (requestObject.index && typeof requestObject.index === 'string' && requestObject.index.split(',').length > 1) {
      return Promise.reject(new BadRequestError('Scroll on multiple indexes is not available.'));
    }

    return kuzzle.pluginsManager.trigger('data:beforeScroll', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.scroll(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterScroll', new ResponseObject(modifiedRequestObject, response)));
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

  this.listIndexes = function readListIndexes (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeListIndexes', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.listIndexes(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterListIndexes', new ResponseObject(modifiedRequestObject, response)));
  };

  this.listCollections = function readListCollections (requestObject) {
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections = [],
      modifiedRequestObject = null;

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return Promise.reject(
        new BadRequestError('listCollections: unrecognized type argument: "' + type + '"')
      );
    }

    return kuzzle.pluginsManager.trigger('data:beforeListCollections', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (type === 'stored') {
          return engine.listCollections(modifiedRequestObject)
            .then(response => {
              response.type = type;
              response.collections = formatCollections(response);
              return kuzzle.pluginsManager.trigger('data:afterListCollections', new ResponseObject(modifiedRequestObject, paginateCollections(requestObject, response)));
            });
        }

        realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections()
          .filter(collection => collection.index === requestObject.index)
          .map(collection => collection.name);

        if (type === 'realtime') {
          let realtimeResponse = {type, collections: {realtime: realtimeCollections}};

          realtimeResponse.collections = formatCollections(realtimeResponse);

          return kuzzle.pluginsManager.trigger('data:afterListCollections', new ResponseObject(modifiedRequestObject, paginateCollections(requestObject, realtimeResponse)));
        }

        return engine.listCollections(modifiedRequestObject)
          .then(response => {
            response.type = type;
            response.collections.realtime = realtimeCollections;
            response.collections = formatCollections(response);
            response = paginateCollections(modifiedRequestObject, response);

            return kuzzle.pluginsManager.trigger('data:afterListCollections', new ResponseObject(modifiedRequestObject, response));
          });
      });
  };

  this.collectionExists = function readCollectionExists (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:beforeCollectionExists', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.collectionExists(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterCollectionExists', new ResponseObject(modifiedRequestObject, response)));
  };

  this.indexExists = function readIndexExists (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:beforeIndexExists', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.indexExists(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterIndexExists', new ResponseObject(modifiedRequestObject, response)));
  };

  this.now = function readNow (requestObject) {
    return kuzzle.pluginsManager.trigger('data:beforeNow', requestObject)
      .then(newRequestObject => kuzzle.pluginsManager.trigger('data:afterNow', new ResponseObject(newRequestObject, {now: Date.now()})));
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

    response.kuzzle.plugins = kuzzle.pluginsManager.getPluginsConfig();

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

/**
 * Uses from and size to paginate response results
 * If type is "all", stored collections are prioritary
 *
 * @param {RequestObject} requestObject
 * @param {*} response
 * @returns {*}
 */
function paginateCollections (requestObject, response) {
  if (requestObject.data.body.from || requestObject.data.body.size) {
    response.from = Number.parseInt(requestObject.data.body.from) || 0;

    if (requestObject.data.body.size) {
      response.size = Number.parseInt(requestObject.data.body.size);

      response.collections = response.collections.slice(response.from, response.from + response.size);
    }
    else {
      response.collections = response.collections.slice(response.from);
    }
  }

  return response;
}

function formatCollections (response) {
  var
    collections = [];
  if (response.collections.realtime) {
    response.collections.realtime.forEach(item => {
      collections.push({name: item, type: 'realtime'});
    });
  }

  if (response.collections.stored) {
    response.collections.stored.forEach(item => {
      collections.push({name: item, type: 'stored'});
    });
  }

  return collections.sort((a, b) => {
    if (a.name > b.name) {
      return 1;
    }
    else if (a.name < b.name) {
      return -1;
    }

    return 0;
  });
}
