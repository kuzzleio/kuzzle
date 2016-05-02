var
  _ = require('lodash'),
  q = require('q'),
  config = require('./config')(),
  rp = require('request-promise'),
  apiVersion = require('../../package.json').apiVersion,
  rewire = require('rewire'),
  RouterController = rewire('../../lib/api/controllers/routerController.js'),
  routes;

var ApiREST = function () {
  this.world = null;
};

ApiREST.prototype.init = function (world) {
  if (routes === undefined) {
    initRoutes.call(this);
  }


  this.world = world;
};

function initRoutes() {
  var
    context = {},
    Router = function () {},
    routerController = new RouterController({
      pluginsManager: {
        routes: []
      },
      config: {
        apiVersion: '1.0'
      }
    });

  Router.prototype.use = Router.prototype.get = Router.prototype.post = Router.prototype.delete = Router.prototype.put = function () {};

  routerController.initRouterHttp.call(context);

  this.routes = routes = RouterController.__get__('routes');
}

ApiREST.prototype.getRequest = function (index, collection, controller, action, args) {
  var
    url = '',
    queryString = [],
    verb = 'GET',
    result;

  if (index) {
    url += index + '/';
  }
  if (collection) {
    url += collection + '/';
  }

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

      url += route.url.replace(/(:[^/]+)/g, function (match) {
        hits.push(match.substring(1));

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
      }).substring(1);

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
    method: verb,
    json: true
  };

  if (verb !== 'GET') {
    result.body = { body: args.body };
  }

  // console.log(util.inspect(result, { depth: 6 }));

  return result;
};

ApiREST.prototype.disconnect = function () {};

ApiREST.prototype.apiPath = function (path) {
  return encodeURI(config.url + '/api/1.0/' + path);
};

ApiREST.prototype.apiBasePath = function (path) {
  return encodeURI(config.url + '/api/' + path);
};

ApiREST.prototype.callApi = function (options) {
  if (this.world.currentUser && this.world.currentUser.token) {
    if (!options.headers) {
      options.headers = {};
    }
    options.headers = _.extend(options.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
  }

  return rp(options);
};

ApiREST.prototype.get = function (id, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.search = function (filters, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_search'),
    method: 'POST',
    json: filters
  };

  return this.callApi(options);
};

ApiREST.prototype.count = function (filters, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_count'),
    method: 'POST',
    json: filters
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
    json: body
  };

  if (Boolean(jwtToken)) {
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
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.createOrReplace = function (body, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/' + body._id),
    method: 'PUT',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.replace = function (body, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/' + body._id + '/_replace'),
    method: 'PUT',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.update = function (id, body, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id + '/_update'),
    method: 'PUT',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteById = function (id, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteByQuery = function (filters, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + (collection || this.world.fakeCollection) + '/_query'),
    method: 'DELETE',
    json: filters
  };

  return this.callApi(options);
};

ApiREST.prototype.bulkImport = function (bulk, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_bulk'),
    method: 'POST',
    json: bulk
  };

  return this.callApi(options);
};

ApiREST.prototype.globalBulkImport = function (bulk) {
  var options = {
    url: this.apiPath('_bulk'),
    method: 'POST',
    json: bulk
  };

  return this.callApi(options);
};

ApiREST.prototype.updateMapping = function (index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_mapping'),
    method: 'PUT',
    json: this.world.schema
  };

  return this.callApi(options);
};

ApiREST.prototype.getStats = function (dates) {
  var options = {
    url: this.apiPath('_getStats'),
    method: 'POST',
    json: dates
  };

  return this.callApi(options);
};

ApiREST.prototype.getLastStats = function () {
  var options = {
    url: this.apiPath('_getLastStats'),
    method: 'GET',
    json: {}
  };

  return this.callApi(options);
};

ApiREST.prototype.getAllStats = function () {
  var options = {
    url: this.apiPath('_getAllStats'),
    method: 'GET',
    json: {}
  };

  return this.callApi(options);
};

ApiREST.prototype.listCollections = function (index, type) {
  var options;

  index = index || this.world.fakeIndex;

  options = {
    url: this.apiPath(index + '/_listCollections'),
    method: 'GET',
    json: true
  };

  if (type) {
    options.url += '/' + type;
  }

  return this.callApi(options);
};

ApiREST.prototype.now = function () {
  var options = {
    url: this.apiPath('_now'),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.truncateCollection = function (index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + (collection || this.world.fakeCollection) + '/_truncate'),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.listIndexes = function () {
  var options = {
    url: this.apiPath('_listIndexes'),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteIndexes = function () {
  var options = {
    url: this.apiPath('_deleteIndexes'),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.createIndex = function (index) {
  var options = {
    url: this.apiPath(index),
    method: 'PUT',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteIndex = function (index) {
  var options = {
    url: this.apiPath(index),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.getServerInfo = function () {
  var options = {
    url: this.apiBasePath('_serverInfo'),
    method: 'GET',
    json: true
  };

  return this.callApi(options)
    .then(res => {
      apiVersion = res.result.serverInfo.kuzzle.api.version;
      return res;
    });
};

ApiREST.prototype.login = function (strategy, credentials) {
  var options = {
    url: this.apiPath('_login'),
    method: 'POST',
    json: {
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
    json: {},
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
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.getRole = function (id) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.mGetRoles = function (body) {
  var options = {
    url: this.apiPath('roles/_mget'),
    method: 'POST',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.searchRoles = function (body) {
  var options = {
    url: this.apiPath('roles/_search'),
    method: 'POST',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteRole = function (id) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.createOrReplaceProfile = function (id, body) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'PUT',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.getProfile = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.mGetProfiles = function (body) {
  var options = {
    url: this.apiPath('profiles/_mget'),
    method: 'POST',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.searchProfiles = function (body) {
  var options = {
    url: this.apiPath('profiles/_search'),
    method: 'POST',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteProfile = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.getUser = function (id) {
  var options = {
    url: this.apiPath('users/' + id),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.getCurrentUser = function () {
  return this.callApi({
    url: this.apiPath('users/_me'),
    method: 'GET',
    json: true
  });
};

ApiREST.prototype.searchUsers = function (body) {
  return this.callApi({
    url: this.apiPath('users/_search'),
    method: 'POST',
    json: { filter: body }
  });
};

ApiREST.prototype.deleteUser = function (id) {
  return this.callApi({
    url: this.apiPath('users/' + id),
    method: 'DELETE',
    json: true
  });
};

ApiREST.prototype.createOrReplaceUser = function (body, id) {
  return this.callApi({
    url: this.apiPath('users/' + id),
    method: 'PUT',
    json: body
  });
};

ApiREST.prototype.createUser = function (body, id) {
  var options = {
    url: this.apiPath('users/_create'),
    method: 'POST',
    json: body
  };
  
  if (id !== undefined) {
    if (body.body) {
      options.json.body._id = id;
    }
    else {
      options.json = {
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
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.checkToken = function (token) {
  return this.callApi({
    url: this.apiPath('_checkToken'),
    method: 'POST',
    json: {token}
  });
};

ApiREST.prototype.refreshIndex = function (index) {
  return this.callApi({
    url: this.apiPath(index + '/_refresh'),
    method: 'POST',
    json: true
  });
};

ApiREST.prototype.callMemoryStorage = function (command, args) {
  return this.callApi(this.getRequest(null, null, 'ms', command, args));
};

ApiREST.prototype.setAutoRefresh = function (index, autoRefresh) {
  return this.callApi(this.getRequest(index, null, 'admin', 'setAutoRefresh', { autoRefresh: autoRefresh }));
};

module.exports = ApiREST;
