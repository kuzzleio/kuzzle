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
    var
      modifiedData = null;

    if (requestObject.index && typeof requestObject.index === 'string' && requestObject.index.split(',').length > 1) {
      return Promise.reject(new BadRequestError('Search on multiple indexes is not available.'));
    }

    return kuzzle.pluginsManager.trigger('data:beforeSearch', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.search(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSearch', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.scroll = function readScroll (requestObject, userContext) {
    var
      modifiedData = null;

    if (requestObject.index && typeof requestObject.index === 'string' && requestObject.index.split(',').length > 1) {
      return Promise.reject(new BadRequestError('Scroll on multiple indexes is not available.'));
    }

    return kuzzle.pluginsManager.trigger('data:beforeScroll', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return engine.scroll(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterScroll', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.get = function readGet (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGet', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return engine.get(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGet', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.count = function readCount (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeCount', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return engine.count(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterCount', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.listIndexes = function readListIndexes (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeListIndexes', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return engine.listIndexes(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterListIndexes', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
      realtimeCollections = [],
      modifiedData = null;

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return Promise.reject(
        new BadRequestError('listCollections: unrecognized type argument: "' + type + '"')
      );
    }

    return kuzzle.pluginsManager.trigger('data:beforeListCollections', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (type === 'stored') {
          return engine.listCollections(modifiedData.requestObject)
            .then(response => {
              response.type = type;
              response.collections = formatCollections(response);
              return kuzzle.pluginsManager.trigger('data:afterListCollections', {
                responseObject: new ResponseObject(modifiedData.requestObject, paginateCollections(modifiedData.requestObject, response)),
                userContext: modifiedData.userContext
              });
            });
        }

        realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections()
          .filter(collection => collection.index === requestObject.index)
          .map(collection => collection.name);

        if (type === 'realtime') {
          let realtimeResponse = {type, collections: {realtime: realtimeCollections}};

          realtimeResponse.collections = formatCollections(realtimeResponse);

          return kuzzle.pluginsManager.trigger('data:afterListCollections', {
            responseObject: new ResponseObject(modifiedData.requestObject, paginateCollections(modifiedData.requestObject, realtimeResponse)),
            userContext: modifiedData.userContext
          });
        }

        return engine.listCollections(modifiedData.requestObject)
          .then(response => {
            response.type = type;
            response.collections.realtime = realtimeCollections;
            response.collections = formatCollections(response);
            response = paginateCollections(modifiedData.requestObject, response);

            return kuzzle.pluginsManager.trigger('data:afterListCollections', {
              responseObject: new ResponseObject(modifiedData.requestObject, response),
              userContext: modifiedData.userContext
            });
          });
      });
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.collectionExists = function readCollectionExists (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeCollectionExists', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return engine.collectionExists(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterCollectionExists', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.indexExists = function readIndexExists (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeIndexExists', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return engine.indexExists(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterIndexExists', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.now = function readNow (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeNow', {requestObject, userContext})
      .then(data => {
        modifiedData = data;
        return kuzzle.pluginsManager.trigger('data:afterNow', {
          responseObject: new ResponseObject(modifiedData.requestObject, {now: Date.now()}),
          userContext: modifiedData.userContext
        });
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
      },
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeServerInfo', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

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
        }, Promise.resolve());
      })
      .then(serviceInfo => {
        if (serviceInfo) {
          response.services[serviceName] = serviceInfo;
        }

        return kuzzle.pluginsManager.trigger('data:afterServerInfo', {
          responseObject: new ResponseObject(modifiedData.requestObject, {serverInfo: response}),
          userContext: modifiedData.userContext
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
