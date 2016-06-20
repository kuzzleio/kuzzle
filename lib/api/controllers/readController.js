var
  q = require('q'),
  os = require('os'),
  _ = require('lodash'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function ReadController (kuzzle) {
  this.search = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeSearch', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.services.list.readEngine.search(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSearch', new ResponseObject(modifiedRequestObject, response)));
  };

  this.get = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGet', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.services.list.readEngine.get(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGet', new ResponseObject(modifiedRequestObject, response)));
  };

  this.count = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeCount', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.services.list.readEngine.count(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterCount', new ResponseObject(requestObject, response)));
  };

  this.listCollections = function (requestObject) {
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections = [],
      modifiedRequestObject = null;

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return q.reject(
        new ResponseObject(requestObject, new BadRequestError('listCollections: unrecognized type argument: "' + type + '"'))
      );
    }

    return kuzzle.pluginsManager.trigger('data:beforeListCollections', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (type === 'stored') {
          return kuzzle.services.list.readEngine.listCollections(modifiedRequestObject)
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

        return kuzzle.services.list.readEngine.listCollections(modifiedRequestObject)
          .then(response => {
            var responseObject = new ResponseObject(modifiedRequestObject, response);

            responseObject.data.body.type = type;
            responseObject.data.body.collections.realtime = realtimeCollections;
            return kuzzle.pluginsManager.trigger('data:afterListCollections', responseObject);
          });
      });
  };

  this.now = function (requestObject) {
    return kuzzle.pluginsManager.trigger('data:beforeNow', requestObject)
      .then(newRequestObject => kuzzle.pluginsManager.trigger('data:afterNow', new ResponseObject(newRequestObject, {now: Date.now()})));
  };

  this.listIndexes = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeListIndexes', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.services.list.readEngine.listIndexes(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterListIndexes', new ResponseObject(modifiedRequestObject, response)));
  };

  this.serverInfo = function (requestObject) {
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
      var actionList = [];

      Object.keys(kuzzle.funnel.controllers[controller]).forEach(action => {
        if (typeof kuzzle.funnel.controllers[controller][action] === 'function') {
          actionList.push(action);
        }
      });

      if (actionList.length > 0) {
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

        return q();
      });
    }, q())
    .then(serviceInfo => {
      if (serviceInfo) {
        response.services[serviceName] = serviceInfo;
      }

      return kuzzle.pluginsManager.trigger('data:afterServerInfo', new ResponseObject(requestObject, {serverInfo: response}));
    });
  };
}

module.exports = ReadController;
