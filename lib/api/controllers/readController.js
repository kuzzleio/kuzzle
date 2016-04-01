var
  q = require('q'),
  os = require('os'),
  _ = require('lodash'),
  BadRequestError = require('../core/errors/badRequestError'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function ReadController (kuzzle) {
  this.search = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:search', requestObject);

    return kuzzle.services.list.readEngine.search(requestObject)
      .then(response => new ResponseObject(requestObject, response));
  };

  this.get = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:get', requestObject);

    return kuzzle.services.list.readEngine.get(requestObject)
      .then(response => new ResponseObject(requestObject, response));
  };

  this.count = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:count', requestObject);

    return kuzzle.services.list.readEngine.count(requestObject)
      .then(response => new ResponseObject(requestObject, response));
  };

  this.listCollections = function (requestObject) {
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections;

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return q.reject(new BadRequestError('listCollections: unrecognized type argument: "' + type + '"'));
    }

    kuzzle.pluginsManager.trigger('data:listCollections', requestObject);

    if (type === 'stored') {
      return kuzzle.services.list.readEngine.listCollections(requestObject).then(response => {
        response.data.body.type = type;
        return q(response);
      });
    }

    realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections();

    if (type === 'realtime') {
      return q(new ResponseObject(requestObject, {type, collections: {realtime: realtimeCollections}}));
    }

    return kuzzle.services.list.readEngine.listCollections(requestObject)
      .then(response => {
        var responseObject = new ResponseObject(requestObject, response);

        responseObject.data.body.type = type;
        responseObject.data.body.collections.realtime = realtimeCollections;
        return q(responseObject);
      });
  };

  this.now = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:now', requestObject);

    return q(new ResponseObject(requestObject, {now: Date.now()}));
  };

  this.listIndexes = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:listIndexes', requestObject);

    return kuzzle.services.list.readEngine.listIndexes(requestObject)
      .then(response => new ResponseObject(requestObject, response));
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