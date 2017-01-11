var
  _ = require('lodash'),
  config = require('./config'),
  rp = require('request-promise'),
  routes = require('../../lib/config/httpRoutes');

var ApiHttp = function () {
  this.world = null;

  this.baseUri = `${config.scheme}://${config.host}:${config.ports.rest}`;
};

ApiHttp.prototype.init = function (world) {
  this.world = world;
};

ApiHttp.prototype.getRequest = function (index, collection, controller, action, args) {
  var
    url = '',
    queryString = [],
    verb = 'GET',
    result;

  if (!args) {
    args = {};
  }
  if (!args.body) {
    if (args.args) {
      args.body = args.args;
    }
    else {
      args.body = {};
    }
  }

  routes.some(route => {
    var
      hits = [];

    // Try / Catch mechanism avoids to match routes that have not all
    // the mandatory arguments for the route
    try {
      if (route.controller === controller && route.action === action) {
        verb = route.verb.toUpperCase();

        url = route.url.replace(/(:[^/]+)/g, function (match) {
          hits.push(match.substring(1));

          if (match === ':index') {
            if (!index) {
              throw new Error('No index provided');
            }
            return index;
          }
          if (match === ':collection') {
            if (!collection) {
              throw new Error('No collection provided');
            }
            return collection;
          }

          if (match === ':_id') {
            if (args._id) {
              return args._id;
            }
            if (args.body._id) {
              return args.body._id;
            }
            throw new Error('No _id provided');
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
              queryString.push(key + '=' + encodeURIComponent(value));
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
    }
    catch (error) {
      return false;
    }

    return false;
  });

  result = {
    url: this.apiPath(url),
    method: verb
  };

  if (verb !== 'GET') {
    result.body = args.body;
  }

  return result;
};

ApiHttp.prototype.disconnect = function () {};

ApiHttp.prototype.apiPath = function (path) {
  return encodeURI(this.baseUri + '/' + path);
};

ApiHttp.prototype.apiBasePath = function (path) {
  return encodeURI(this.baseUri + '/' + path);
};

/**
 *
 * @param options
 * @return {Promise.<IncomingMessage>}
 */
ApiHttp.prototype.callApi = function (options) {
  if (this.world.currentUser && this.world.currentUser.token) {
    if (!options.headers) {
      options.headers = {};
    }
    options.headers = _.extend(options.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
  }
  options.json = true;
  options.forever = true;

  return rp(options);
};

ApiHttp.prototype.get = function (id, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.search = function (query, index, collection, args) {
  var
    qs,
    options = {
      url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' +
                          ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/_search'),
      method: 'POST',
      body: query
    };

  if (args) {
    qs = [];
    options.url+= '?';

    if (args.scroll) {
      qs.push('scroll=' + args.scroll);
    }
    if (args.from) {
      qs.push('from=' + args.from);
    }
    if (args.size) {
      qs.push('size=' + args.size);
    }

    options.url+= qs.join('&');
  }

  return this.callApi(options);
};

ApiHttp.prototype.scroll = function (scrollId) {
  var options = {
    url: this.apiPath('_scroll/'.concat(scrollId)),
    method: 'POST'
  };

  return this.callApi(options);
};

ApiHttp.prototype.count = function (query, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' +
                        ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/_count'),
    method: 'POST',
    body: query
  };

  return this.callApi(options);
};

ApiHttp.prototype.create = function (body, index, collection, jwtToken) {
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

ApiHttp.prototype.publish = function (body, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_publish'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.createOrReplace = function (body, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/' + body._id),
    method: 'PUT',
    body
  };

  delete body._id;

  return this.callApi(options);
};

ApiHttp.prototype.replace = function (body, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + ((typeof collection !== 'string') ? this.world.fakeCollection : collection) + '/' + body._id + '/_replace'),
    method: 'PUT',
    body
  };

  delete body._id;

  return this.callApi(options);
};

ApiHttp.prototype.update = function (id, body, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id + '/_update'),
    method: 'PUT',
    body
  };

  delete body._id;

  return this.callApi(options);
};

ApiHttp.prototype.deleteById = function (id, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteByQuery = function (query, index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + (collection || this.world.fakeCollection) + '/_query'),
    method: 'DELETE',
    body: query
  };

  return this.callApi(options);
};

ApiHttp.prototype.bulkImport = function (bulk, index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_bulk'),
    method: 'POST',
    body: {bulkData: bulk}
  };

  return this.callApi(options);
};

ApiHttp.prototype.globalBulkImport = function (bulk) {
  var options = {
    url: this.apiPath('_bulk'),
    method: 'POST',
    body: {bulkData: bulk}
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateMapping = function (index) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + this.world.fakeCollection + '/_mapping'),
    method: 'PUT',
    body: this.world.schema
  };

  return this.callApi(options);
};

ApiHttp.prototype.getProfileMapping = function () {
  var options = {
    url: this.apiPath('/profiles/_mapping'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateProfileMapping = function () {
  var options = {
    url: this.apiPath('/profiles/_mapping'),
    method: 'PUT',
    body: this.world.securitySchema
  };

  return this.callApi(options);
};

ApiHttp.prototype.getRoleMapping = function () {
  var options = {
    url: this.apiPath('/roles/_mapping'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateRoleMapping = function () {
  var options = {
    url: this.apiPath('/roles/_mapping'),
    method: 'PUT',
    body: this.world.securitySchema
  };

  return this.callApi(options);
};

ApiHttp.prototype.getUserMapping = function () {
  var options = {
    url: this.apiPath('/users/_mapping'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateUserMapping = function () {
  var options = {
    url: this.apiPath('/users/_mapping'),
    method: 'PUT',
    body: this.world.securitySchema
  };

  return this.callApi(options);
};

ApiHttp.prototype.getStats = function (dates) {
  var options = {
    url: this.apiPath('_getStats'),
    method: 'POST',
    body: dates
  };

  return this.callApi(options);
};

ApiHttp.prototype.getLastStats = function () {
  var options = {
    url: this.apiPath('_getLastStats'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getAllStats = function () {
  var options = {
    url: this.apiPath('_getAllStats'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.listCollections = function (index, type) {
  var options;

  index = index || this.world.fakeIndex;

  options = {
    url: this.apiPath(index + '/_list'),
    method: 'GET'
  };

  if (type) {
    options.url += '/' + type;
  }

  return this.callApi(options);
};

ApiHttp.prototype.now = function () {
  var options = {
    url: this.apiPath('_now'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.truncateCollection = function (index, collection) {
  var options = {
    url: this.apiPath(((typeof index !== 'string') ? this.world.fakeIndex : index) + '/' + (collection || this.world.fakeCollection) + '/_truncate'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.listIndexes = function () {
  var options = {
    url: this.apiPath('_list'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteIndexes = function () {
  var options = {
    url: this.apiPath('_mdelete'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.createIndex = function (index) {
  var options = {
    url: this.apiPath(index + '/_create'),
    method: 'POST'
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteIndex = function (index) {
  var options = {
    url: this.apiPath(index),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getServerInfo = function () {
  var options = {
    url: this.apiBasePath('_serverInfo'),
    method: 'GET'
  };

  return this.callApi(options)
    .then(res => {
      return res;
    });
};

ApiHttp.prototype.login = function (strategy, credentials) {
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

ApiHttp.prototype.logout = function (jwtToken) {
  var options = {
    url: this.apiPath('_logout'),
    method: 'GET',
    headers: {
      authorization: 'Bearer ' + jwtToken
    }
  };

  return this.callApi(options);
};

ApiHttp.prototype.createOrReplaceRole = function (id, body) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.getRole = function (id) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.mGetRoles = function (body) {
  var options = {
    url: this.apiPath('roles/_mget'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.searchRoles = function (body) {
  var options = {
    url: this.apiPath('roles/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteRole = function (id) {
  var options = {
    url: this.apiPath('roles/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.createOrReplaceProfile = function (id, body) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.getProfile = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getProfileRights = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id + '/_rights'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.mGetProfiles = function (body) {
  var options = {
    url: this.apiPath('profiles/_mget'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.searchProfiles = function (body) {
  var options = {
    url: this.apiPath('profiles/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteProfile = function (id) {
  var options = {
    url: this.apiPath('profiles/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.searchValidations = function (body) {
  var options = {
    url: this.apiPath('validations/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.getUser = function (id) {
  var options = {
    url: this.apiPath('users/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getUserRights = function (id) {
  var options = {
    url: this.apiPath('users/' + id + '/_rights'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getCurrentUser = function () {
  return this.callApi({
    url: this.apiPath('users/_me'),
    method: 'GET'
  });
};

ApiHttp.prototype.getMyRights = function () {
  var options = {
    url: this.apiPath('users/_me/_rights'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.searchUsers = function (body) {
  return this.callApi({
    url: this.apiPath('users/_search'),
    method: 'POST',
    body: { query: body }
  });
};

ApiHttp.prototype.deleteUser = function (id) {
  return this.callApi({
    url: this.apiPath('users/' + id),
    method: 'DELETE'
  });
};

ApiHttp.prototype.createOrReplaceUser = function (body, id) {
  return this.callApi({
    url: this.apiPath('users/' + id),
    method: 'PUT',
    body
  });
};

ApiHttp.prototype.createUser = function (body, id) {
  var options = {
    url: this.apiPath('users/' + id + '/_create'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.createRestrictedUser = function (body, id) {
  var options = {
    url: this.apiPath('users/' + id + '/_createRestricted'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateSelf = function (body) {
  var options = {
    url: this.apiPath('_updateSelf'),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.checkToken = function (token) {
  return this.callApi({
    url: this.apiPath('_checkToken'),
    method: 'POST',
    body: {token}
  });
};

ApiHttp.prototype.refreshIndex = function (index) {
  return this.callApi({
    url: this.apiPath(index + '/_refresh'),
    method: 'POST'
  });
};

ApiHttp.prototype.callMemoryStorage = function (command, args) {
  return this.callApi(this.getRequest(null, null, 'ms', command, args));
};

ApiHttp.prototype.getAutoRefresh = function (index) {
  return this.callApi(this.getRequest(index, null, 'index', 'getAutoRefresh'));
};

ApiHttp.prototype.setAutoRefresh = function (index, autoRefresh) {
  return this.callApi(this.getRequest(index, null, 'index', 'setAutoRefresh', {body: {autoRefresh}}));
};

ApiHttp.prototype.indexExists = function (index) {
  return this.callApi(this.getRequest(index, null, 'index', 'exists'));
};

ApiHttp.prototype.collectionExists = function (index, collection) {
  return this.callApi(this.getRequest(index, collection, 'collection', 'exists'));
};

ApiHttp.prototype.getSpecifications = function (index, collection) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_specifications'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateSpecifications = function (specifications) {
  var options = {
    url: this.apiPath('_specifications'),
    method: 'PUT',
    body: specifications
  };

  return this.callApi(options);
};

ApiHttp.prototype.validateSpecifications = function (specifications) {
  var options = {
    url: this.apiPath('_validateSpecifications'),
    method: 'POST',
    body: specifications
  };

  return this.callApi(options);
};

ApiHttp.prototype.validateDocument = function (index, collection, document) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_validate'),
    method: 'POST',
    body: document
  };

  return this.callApi(options);
};

ApiHttp.prototype.postDocument = function (index, collection, document) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_create'),
    method: 'POST',
    body: document
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteSpecifications = function (index, collection) {
  var options = {
    url: this.apiPath(index + '/' + collection + '/_specifications'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

module.exports = ApiHttp;
