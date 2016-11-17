var
  _ = require('lodash'),
  config = require('./config'),
  rp = require('request-promise'),
  rewire = require('rewire'),
  RouterController = rewire('../../lib/api/controllers/routerController.js'),
  routes;

var ApiREST = function () {
  this.world = null;

  this.baseUri = `${config.scheme}://${config.host}:${config.ports.rest}`;
};

ApiREST.prototype.init = function (world) {
  if (routes === undefined) {
    initRoutes.call(this);
  }

  this.world = world;
};

/**
 * @this ApiREST
 */
function initRoutes() {
  var
    context = {},
    Router = function () {},
    routerController = new RouterController({
      pluginsManager: {
        routes: []
      },
      config: require('../../default.config')
    });

  Router.prototype.use = Router.prototype.get = Router.prototype.post = Router.prototype.delete = Router.prototype.put = function () {};

  routerController.initHttpRouter.call(context);

  this.routes = routes = RouterController.__get__('routes');
}

ApiREST.prototype.getRequest = function (index, collection, controller, action, args) {
  var
    url = '',
    queryString = [],
    verb = 'GET',
    result;

  if (!args) {
    args = {};
  }
  if (!args.body) {
    args.body = {};
  }

  routes.some(route => {
    var
      hits = [];

    if (route.controller === controller && route.action === action) {
      verb = route.verb.toUpperCase();

      url = route.url.replace(/(:[^/]+)/g, function (match) {
        hits.push(match.substring(1));

        if (match === ':index') {
          return index;
        }
        if (match === ':collection') {
          return collection;
        }

        if (match === ':id') {
          if (args._id) {
            return args._id;
          }
          if (args.body._id) {
            return args.body._id;
          }
        }

        if (args.body[match.substring(1)] !== undefined) {
          return args.body[match.substring(1)];
        }

        return '';
      });

      // add extra aguments in the query string
      if (verb === 'GET') {
        _.difference(Object.keys(args.body), hits).forEach(key => {
          var value = args.body[key];

          if (_.isArray(value)) {
            queryString = queryString.concat(value.map(v => key + '=' + encodeURIComponent(v)));
          }
          else {
            queryString.push(key + '=' + encodeURIComponent(args.body[key]));
          }
        });

        if (queryString.length) {
          url += '?' + queryString.join('&');
        }
      }

      url = url
        .replace(/\/\//g, '/')
        .replace(/\/$/, '');

      return true;
    }

    return false;
  });

  result = {
    url: this.apiPath(url),
    method: verb
  };

  if (verb !== 'GET') {
    result.body = { body: args.body };
  }

  return result;
};

ApiREST.prototype.disconnect = function () {};

ApiREST.prototype.apiPath = function (path) {
  return encodeURI(this.baseUri + '/api/1.0/' + path);
};

ApiREST.prototype.apiBasePath = function (path) {
  return encodeURI(this.baseUri + '/api/' + path);
};

ApiREST.prototype.callApi = function (options) {
  if (this.world.currentUser && this.world.currentUser.token) {
    if (!options.headers) {
      options.headers = {};
    }
    options.headers = _.extend(options.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
  }
  options.json = true;

  return rp(options);
};

ApiREST.prototype.get = function (id, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.search = function (query, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' +
                        ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/_search'),
    method: 'POST',
    body: query
  };

  return this.callApi(options);
};

ApiREST.prototype.scroll = function (scrollId) {
  var options = {
    url: this.apiPath('_scroll/'.concat(scrollId)),
    method: 'POST'
  };

  return this.callApi(options);
};

ApiREST.prototype.count = function (query, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' +
                        ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/_count'),
    method: 'POST',
    body: query
  };

  return this.callApi(options);
};

ApiREST.prototype.create = function (body, index, collection, jwtToken) {
  var options = {
    url: this.apiPath(
      ((typeof index !== 'string') ? this.world.fakeIndex : index) +
      '/' +
      ((typeof collection !== 'string') ? this.world.fakeCollection : collection) +
      '/_create'
    ),
    method: 'POST',
    body
  };

  if (jwtToken) {
    options.headers = {
      authorization: 'Bearer ' + jwtToken
    };
  }

  return this.callApi(options);
};

ApiREST.prototype.publish = function (body, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.createOrReplace = function (body, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/' + body._id),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.replace = function (body, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/' + body._id + '/_replace'),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.update = function (id, body, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id + '/_update'),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteById = function (id, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteByQuery = function (query, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + (collection || this.world.fakeCollection) + '/_query'),
    method: 'DELETE',
    body: query
  };

  return this.callApi(options);
};

ApiREST.prototype.bulkImport = function (bulk, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_bulk'),
    method: 'POST',
    body: {bulkData: bulk}
  };

  return this.callApi(options);
};

ApiREST.prototype.globalBulkImport = function (bulk) {
  var options = {
    url: this.apiPath('_bulk'),
    method: 'POST',
    body: {bulkData: bulk}
  };

  return this.callApi(options);
};

ApiREST.prototype.updateMapping = function (index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_mapping'),
    method: 'PUT',
    body: this.world.schema
  };

  return this.callApi(options);
};

ApiREST.prototype.getStats = function (dates) {
  var options = {
    url: this.apiPath('_getStats'),
    method: 'POST',
    body: dates
  };

  return this.callApi(options);
};

ApiREST.prototype.getLastStats = function () {
  var options = {
    url: this.apiPath('_getLastStats'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.getAllStats = function () {
  var options = {
    url: this.apiPath('_getAllStats'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.listCollections = function (index, type) {
  var options;

  index = index || this.world.fakeIndex;

  options = {
    url: this.apiPath(index + '/_listCollections'),
    method: 'GET'
  };

  if (type) {
    options.url += '/' + type;
  }

  return this.callApi(options);
};

ApiREST.prototype.now = function () {
  var options = {
    url: this.apiPath('_now'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.truncateCollection = function (index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + (collection || this.world.fakeCollection) + '/_truncate'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiREST.prototype.listIndexes = function () {
  var options = {
    url: this.apiPath('_listIndexes'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteIndexes = function () {
  var options = {
    url: this.apiPath('_deleteIndexes'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiREST.prototype.createIndex = function (index) {
  var options = {
    url: this.apiPath(index),
    method: 'PUT'
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteIndex = function (index) {
  var options = {
    url: this.apiPath(index),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiREST.prototype.getServerInfo = function () {
  var options = {
    url: this.apiBasePath('_serverInfo'),
    method: 'GET'
  };

  return this.callApi(options)
    .then(res => {
      return res;
    });
};

ApiREST.prototype.login = function (strategy, credentials) {
  var options = {
    url: this.apiPath('_login'),
    method: 'POST',
    body: {
      strategy: strategy,
      username: credentials.username,
      password: credentials.password
    }
  };

  return this.callApi(options);
};

ApiREST.prototype.logout = function (jwtToken) {
  var options = {
    url: this.apiPath('_logout'),
    method: 'GET',
    headers: {
      authorization: 'Bearer ' + jwtToken
    }
  };

  return this.callApi(options);
};

ApiREST.prototype.createOrReplaceRole = function (id, body) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.getRole = function (id) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.mGetRoles = function (body) {
  var options = {
    url: this.apiPath('roles/_mget'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.searchRoles = function (body) {
  var options = {
    url: this.apiPath('roles/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteRole = function (id) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiREST.prototype.createOrReplaceProfile = function (id, body) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.getProfile = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.getProfileRights = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id + '/_rights'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.mGetProfiles = function (body) {
  var options = {
    url: this.apiPath('profiles/_mget'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.searchProfiles = function (body) {
  var options = {
    url: this.apiPath('profiles/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteProfile = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiREST.prototype.searchValidations = function (body) {
  var options = {
    url: this.apiPath('validations/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.getUser = function (id) {
  var options = {
    url: this.apiPath('users/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.getUserRights = function (id) {
  var options = {
    url: this.apiPath('users/' + id + '/_rights'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.getCurrentUser = function () {
  return this.callApi({
    url: this.apiPath('users/_me'),
    method: 'GET'
  });
};

ApiREST.prototype.getMyRights = function () {
  var options = {
    url: this.apiPath('users/_me/_rights'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.searchUsers = function (body) {
  return this.callApi({
    url: this.apiPath('users/_search'),
    method: 'POST',
    body: { query: body }
  });
};

ApiREST.prototype.deleteUser = function (id) {
  return this.callApi({
    url: this.apiPath('users/' + id),
    method: 'DELETE'
  });
};

ApiREST.prototype.createOrReplaceUser = function (body, id) {
  return this.callApi({
    url: this.apiPath('users/' + id),
    method: 'PUT',
    body
  });
};

ApiREST.prototype.createUser = function (body, id) {
  var options = {
    url: this.apiPath('users/_create'),
    method: 'POST',
    body
  };

  if (id !== undefined) {
    if (body.body) {
      options.body.body._id = id;
    }
    else {
      options.body = {
        _id: id,
        body: body
      };
    }
  }

  return this.callApi(options);
};

ApiREST.prototype.createRestrictedUser = function (body, id) {
  var options = {
    url: this.apiPath('users/_createRestricted'),
    method: 'POST',
    body
  };

  if (id !== undefined) {
    if (body.body) {
      options.body.body._id = id;
    }
    else {
      options.body = {
        _id: id,
        body: body
      };
    }
  }

  return this.callApi(options);
};

ApiREST.prototype.updateSelf = function (body) {
  var options = {
    url: this.apiPath('_updateSelf'),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiREST.prototype.checkToken = function (token) {
  return this.callApi({
    url: this.apiPath('_checkToken'),
    method: 'POST',
    body: {token}
  });
};

ApiREST.prototype.refreshIndex = function (index) {
  return this.callApi({
    url: this.apiPath(index + '/_refresh'),
    method: 'POST'
  });
};

ApiREST.prototype.callMemoryStorage = function (command, args) {
  return this.callApi(this.getRequest(null, null, 'ms', command, args));
};

ApiREST.prototype.getAutoRefresh = function (index) {
  return this.callApi(this.getRequest(index, null, 'admin', 'getAutoRefresh'));
};

ApiREST.prototype.setAutoRefresh = function (index, autoRefresh) {
  return this.callApi(this.getRequest(index, null, 'admin', 'setAutoRefresh', { body: {autoRefresh: autoRefresh }}));
};

ApiREST.prototype.indexExists = function (index) {
  return this.callApi(this.getRequest(index, null, 'read', 'indexExists'));
};

ApiREST.prototype.collectionExists = function (index, collection) {
  return this.callApi(this.getRequest(index, collection, 'read', 'collectionExists'));
};

ApiREST.prototype.getSpecifications = function (index, collection) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_specifications'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiREST.prototype.updateSpecifications = function (specifications) {
  var options = {
    url: this.apiPath('_specifications'),
    method: 'PUT',
    body: specifications
  };

  return this.callApi(options);
};

ApiREST.prototype.validateSpecifications = function (specifications) {
  var options = {
    url: this.apiPath('_validateSpecifications'),
    method: 'POST',
    body: specifications
  };

  return this.callApi(options);
};

ApiREST.prototype.validateDocument = function (index, collection, document) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_validate'),
    method: 'POST',
    body: document
  };

  return this.callApi(options);
};

ApiREST.prototype.postDocument = function (index, collection, document) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_create'),
    method: 'PUT',
    body: document
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteSpecifications = function (index, collection) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_specifications'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

module.exports = ApiREST;
