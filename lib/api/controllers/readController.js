'use strict';

var
  Promise = require('bluebird'),
  os = require('os'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  assertBody = require('./util/requestAssertions').assertBody,
  assertId = require('./util/requestAssertions').assertId,
  assertIndex = require('./util/requestAssertions').assertIndex,
  assertIndexAndCollection = require('./util/requestAssertions').assertIndexAndCollection;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function ReadController (kuzzle) {
  var engine = kuzzle.services.list.storageEngine;

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.search = function readSearch (request) {
    assertIndexAndCollection(request, 'search');

    if (request.input.resource.index.split(',').length > 1) {
      throw new BadRequestError('search on multiple indexes is not available.');
    }
    if (request.input.resource.collection.split(',').length > 1) {
      throw new BadRequestError('search on multiple collections is not available.');
    }

    return engine.search(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.scroll = function readScroll (request) {
    return engine.scroll(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.get = function readGet (request) {
    assertId(request, 'get');

    return engine.get(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.count = function readCount (request) {
    assertBody(request, 'count');

    return engine.count(request);
  };

  /**
   * @returns {Promise<Object>}
   */
  this.listIndexes = function readListIndexes () {
    return engine.listIndexes();
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.listCollections = function readListCollections (request) {
    var
      type = request.input.args.type ? request.input.args.type : 'all',
      realtimeCollections = [];

    assertIndex(request, 'listCollections');

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return Promise.reject(new BadRequestError(`listCollections: unrecognized type argument: "${type}"`));
    }

    if (type === 'stored') {
      return engine.listCollections(request)
        .then(response => {
          response.type = type;
          response.collections = formatCollections(response);
          return Promise.resolve(response);
        });
    }

    realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections()
      .filter(collection => collection.index === request.input.resource.index)
      .map(collection => collection.name);

    if (type === 'realtime') {
      let realtimeResponse = {type, collections: {realtime: realtimeCollections}};

      realtimeResponse.collections = formatCollections(realtimeResponse);

      return Promise.resolve(realtimeResponse);
    }

    return engine.listCollections(request)
      .then(response => {
        response.type = type;
        response.collections.realtime = realtimeCollections;
        response.collections = formatCollections(response);
        response = paginateCollections(request, response);

        return Promise.resolve(response);
      });
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.collectionExists = function readCollectionExists (request) {
    assertIndexAndCollection(request, 'collectionExists');

    return engine.collectionExists(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.indexExists = function readIndexExists (request) {
    assertIndex(request, 'indexExists');

    return engine.indexExists(request);
  };

  /**
   * @returns {Promise<Object>}
   */
  this.now = function readNow () {
    return Promise.resolve({now: Date.now()});
  };

  /**
   * @returns {Promise<Object>}
   */
  this.serverInfo = function readServerInfo () {
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

        return Promise.resolve({serverInfo: response});
      });
  };
}

module.exports = ReadController;

/**
 * Uses from and size to paginate response results
 * If type is "all", stored collections are prioritary
 *
 * @param {Request} request
 * @param {object} response
 * @returns {object}
 */
function paginateCollections (request, response) {
  if (request.input.args.from || request.input.args.size) {
    if (request.input.args.from) {
      response.from = Number.parseInt(request.input.args.from);
    }
    else {
      response.from = 0;
    }

    if (request.input.args.size) {
      response.size = Number.parseInt(request.input.args.size);

      response.collections = response.collections.slice(response.from, response.from + response.size);
    }
    else {
      response.collections = response.collections.slice(response.from);
    }
  }

  return response;
}

/**
 * @param {object} response
 * @returns {Array.<{name: string, type: string}>}
 */
function formatCollections (response) {
  var collections = [];

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
