var
  q = require('q'),
  os = require('os'),
  _ = require('lodash'),
  BadRequestError = require('../core/errors/badRequestError'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function ReadController (kuzzle) {
  this.search = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:search', requestObject);

    return kuzzle.services.list.readEngine.search(requestObject);
  };

  this.get = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:get', requestObject);

    return kuzzle.services.list.readEngine.get(requestObject);
  };

  this.count = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:count', requestObject);

    return kuzzle.services.list.readEngine.count(requestObject);
  };

  this.listCollections = function (requestObject, context) {
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections;
    var filterCollections = (response, collectionType) => {
      var rightsRequest = {
          action: 'listCollections',
          controller: 'read',
          index: requestObject.index
        },
        allowedCollections = [];

      response.data.collections[collectionType].forEach(collection => {
        rightsRequest.collection = collection;

        if (context.user.profile.isActionAllowed(rightsRequest, context) === true) {
          allowedCollections.push(collection);
        }
      });

      response.data.collections[collectionType] = allowedCollections;

      return response;
    };

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return q.reject(new BadRequestError('listCollections: unrecognized type argument: "' + type + '"'));
    }

    kuzzle.pluginsManager.trigger('data:listCollections', requestObject);

    if (type === 'stored') {
      return kuzzle.services.list.readEngine.listCollections(requestObject).then(response => {
        response.data.type = type;
        return q(filterCollections(response, 'stored'));
      });
    }

    realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections();

    if (type === 'realtime') {
      return q(filterCollections(new ResponseObject(requestObject, {type, collections: {realtime: realtimeCollections}}), 'realtime'));
    }

    return kuzzle.services.list.readEngine.listCollections(requestObject)
      .then(response => {
        response.data.type = type;
        response.data.collections.realtime = realtimeCollections;
        filterCollections(response, 'realtime');
        filterCollections(response, 'stored');
        return q(response);
      });
  };

  this.now = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:now', requestObject);

    return q(new ResponseObject(requestObject, {now: Date.now()}));
  };

  this.listIndexes = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:listIndexes', requestObject);

    return kuzzle.services.list.readEngine.listIndexes(requestObject);
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

    Object.keys(kuzzle.funnel).forEach(controller => {
      var actionList = [];

      if (typeof kuzzle.funnel[controller] === 'object') {
        Object.keys(kuzzle.funnel[controller]).forEach(action => {
          if (typeof kuzzle.funnel[controller][action] === 'function') {
            actionList.push(action);
          }
        });

        if (actionList.length > 0) {
          response.kuzzle.api.routes[controller] = actionList;
        }
      }
    });

    Object.keys(kuzzle.pluginsManager.plugins).forEach(plugin => {
      var
        pluginInfo = kuzzle.pluginsManager.plugins[plugin],
        p = {
          name: pluginInfo.name,
          version: pluginInfo.version,
          activated: pluginInfo.activated
        };

      p.hooks = _.uniq(Object.keys(pluginInfo.object.hooks));

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

      return new ResponseObject(requestObject, {serverInfo: response});
    });
  };
};