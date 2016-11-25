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

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.search = function readSearch (requestObject, userContext) {
    if (requestObject.index && typeof requestObject.index === 'string' && requestObject.index.split(',').length > 1) {
      return Promise.reject(new BadRequestError('Search on multiple indexes is not available.'));
    }

    return engine.search(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext: userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.scroll = function readScroll (requestObject, userContext) {
    if (requestObject.index && typeof requestObject.index === 'string' && requestObject.index.split(',').length > 1) {
      return Promise.reject(new BadRequestError('Scroll on multiple indexes is not available.'));
    }
    return engine.scroll(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext: userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.get = function readGet (requestObject, userContext) {
    return engine.get(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.count = function readCount (requestObject, userContext) {
    return engine.count(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.listIndexes = function readListIndexes (requestObject, userContext) {
    return engine.listIndexes(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.listCollections = function readListCollections (requestObject, userContext) {
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections = [];

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return Promise.reject(
        new BadRequestError('listCollections: unrecognized type argument: "' + type + '"')
      );
    }

    if (type === 'stored') {
      return engine.listCollections(requestObject)
        .then(response => {
          response.type = type;
          response.collections = formatCollections(response);
          return Promise.resolve({
            responseObject: new ResponseObject(requestObject, paginateCollections(requestObject, response)),
            userContext
          });
        });
    }

    realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections()
      .filter(collection => collection.index === requestObject.index)
      .map(collection => collection.name);

    if (type === 'realtime') {
      let realtimeResponse = {type, collections: {realtime: realtimeCollections}};

      realtimeResponse.collections = formatCollections(realtimeResponse);

      return Promise.resolve({
        responseObject: new ResponseObject(requestObject, paginateCollections(requestObject, realtimeResponse)),
        userContext
      });
    }

    return engine.listCollections(requestObject)
      .then(response => {
        response.type = type;
        response.collections.realtime = realtimeCollections;
        response.collections = formatCollections(response);
        response = paginateCollections(requestObject, response);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.collectionExists = function readCollectionExists (requestObject, userContext) {
    return engine.collectionExists(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.indexExists = function readIndexExists (requestObject, userContext) {
    return engine.indexExists(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.now = function readNow (requestObject, userContext) {
    return Promise.resolve({
      responseObject: new ResponseObject(requestObject, {now: Date.now()}),
      userContext
    });
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.serverInfo = function readServerInfo (requestObject, userContext) {
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

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, {serverInfo: response}),
          userContext: userContext
        });
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
