const
  _ = require('lodash'),
  config = require('./config'),
  rp = require('request-promise'),
  routes = require('../../lib/config/httpRoutes');

/**
 * @constructor
 */
function ApiHttp () {
  this.world = null;

  this.baseUri = `${config.scheme}://${config.host}:${config.port}`;

  this.util = {
    getIndex: index => typeof index !== 'string' ? this.world.fakeIndex : index,
    getCollection: collection => typeof collection !== 'string' ? this.world.fakeCollection : collection
  };

  return this;
}

ApiHttp.prototype.init = function (world) {
  this.world = world;
};

ApiHttp.prototype.getRequest = function (index, collection, controller, action, args) {
  let
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
    const hits = [];

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
            const value = args.body[key];

            if (_.isArray(value)) {
              queryString.push(...value.map(v => `${key}=${v}`));
            }
            else {
              queryString.push(`${key}=${value}`);
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
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.mGet = function(body, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mGet'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.search = function (query, index, collection, args) {
  const
    options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_search'),
      method: 'POST',
      body: query
    };

  if (args) {
    let qs = [];
    options.url += '?';

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

ApiHttp.prototype.scroll = function (scrollId, scroll) {
  const options = {
    url: this.apiPath(`_scroll/${scrollId}`),
    method: 'GET'
  };

  if (scroll) {
    options.url += '?scroll=' + scroll;
  }

  return this.callApi(options);
};

ApiHttp.prototype.count = function (query, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_count'),
    method: 'POST',
    body: query
  };

  return this.callApi(options);
};

ApiHttp.prototype.create = function (body, index, collection, jwtToken, id) {
  const
    url = id
      ? this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/' + id + '/_create')
      : this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_create'),
    options = {
      url: url,
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

ApiHttp.prototype.mCreate = function (body, index, collection, jwtToken) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mCreate'),
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
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/_publish'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.createOrReplace = function (body, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/' + body._id),
    method: 'PUT',
    body
  };

  delete body._id;

  return this.callApi(options);
};

ApiHttp.prototype.mCreateOrReplace = function (body, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mCreateOrReplace'),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.replace = function (body, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/' + body._id + '/_replace'),
    method: 'PUT',
    body
  };

  delete body._id;

  return this.callApi(options);
};

ApiHttp.prototype.mReplace = function (body, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mReplace'),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.update = function (id, body, index) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/' + id + '/_update'),
    method: 'PUT',
    body
  };

  delete body._id;

  return this.callApi(options);
};

ApiHttp.prototype.mUpdate = function (body, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mUpdate'),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteById = function (id, index) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.mDelete = function (body, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mDelete'),
    method: 'DELETE',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteByQuery = function (query, index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_query'),
    method: 'DELETE',
    body: query
  };

  return this.callApi(options);
};

ApiHttp.prototype.bulkImport = function (bulk, index) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/_bulk'),
    method: 'POST',
    body: {bulkData: bulk}
  };

  return this.callApi(options);
};

ApiHttp.prototype.globalBulkImport = function (bulk) {
  const options = {
    url: this.apiPath('_bulk'),
    method: 'POST',
    body: {bulkData: bulk}
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateMapping = function (index) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/_mapping'),
    method: 'PUT',
    body: this.world.mapping
  };

  return this.callApi(options);
};

ApiHttp.prototype.getProfileMapping = function () {
  const options = {
    url: this.apiPath('/profiles/_mapping'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateProfileMapping = function () {
  const options = {
    url: this.apiPath('/profiles/_mapping'),
    method: 'PUT',
    body: this.world.securitymapping
  };

  return this.callApi(options);
};

ApiHttp.prototype.getRoleMapping = function () {
  const options = {
    url: this.apiPath('/roles/_mapping'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateRoleMapping = function () {
  const options = {
    url: this.apiPath('/roles/_mapping'),
    method: 'PUT',
    body: this.world.securitymapping
  };

  return this.callApi(options);
};

ApiHttp.prototype.getUserMapping = function () {
  const options = {
    url: this.apiPath('/users/_mapping'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateUserMapping = function () {
  const options = {
    url: this.apiPath('/users/_mapping'),
    method: 'PUT',
    body: this.world.securitymapping
  };

  return this.callApi(options);
};

ApiHttp.prototype.getStats = function (dates) {
  const options = {
    url: this.apiPath('_getStats'),
    method: 'POST',
    body: dates
  };

  return this.callApi(options);
};

ApiHttp.prototype.getLastStats = function () {
  const options = {
    url: this.apiPath('_getLastStats'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getAllStats = function () {
  const options = {
    url: this.apiPath('_getAllStats'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.listCollections = function (index = this.world.fakeIndex, type) {
  const options = {
    url: this.apiPath(index + '/_list'),
    method: 'GET'
  };

  if (type) {
    options.url += '/' + type;
  }

  return this.callApi(options);
};

ApiHttp.prototype.now = function () {
  const options = {
    url: this.apiPath('_now'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.truncateCollection = function (index, collection) {
  const options = {
    url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_truncate'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.listIndexes = function () {
  const options = {
    url: this.apiPath('_list'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteIndexes = function () {
  const options = {
    url: this.apiPath('_mdelete'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.createIndex = function (index) {
  const options = {
    url: this.apiPath(index + '/_create'),
    method: 'POST'
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteIndex = function (index) {
  const options = {
    url: this.apiPath(index),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getServerInfo = function () {
  const options = {
    url: this.apiBasePath('_serverInfo'),
    method: 'GET'
  };

  return this.callApi(options)
    .then(res => {
      return res;
    });
};

ApiHttp.prototype.login = function (strategy, credentials) {
  const options = {
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
  const options = {
    url: this.apiPath('_logout'),
    method: 'GET',
    headers: {
      authorization: 'Bearer ' + jwtToken
    }
  };

  return this.callApi(options);
};

ApiHttp.prototype.createOrReplaceRole = function (id, body) {
  const options = {
    url: this.apiPath('roles/' + id),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.getRole = function (id) {
  const options = {
    url: this.apiPath('roles/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.mGetRoles = function (body) {
  const options = {
    url: this.apiPath('roles/_mGet'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.searchRoles = function (body, args) {
  const options = {
    url: this.apiPath('roles/_search'),
    method: 'POST',
    body
  };

  if (args) {
    let qs = [];
    options.url += '?';

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

ApiHttp.prototype.deleteRole = function (id) {
  const options = {
    url: this.apiPath('roles/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.createOrReplaceProfile = function (id, body) {
  const options = {
    url: this.apiPath('profiles/' + id),
    method: 'PUT',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.getProfile = function (id) {
  const options = {
    url: this.apiPath('profiles/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getProfileRights = function (id) {
  const options = {
    url: this.apiPath('profiles/' + id + '/_rights'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.mGetProfiles= function (body) {
  const options = {
    url: this.apiPath('profiles/_mGet'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.searchProfiles = function (body) {
  const options = {
    url: this.apiPath('profiles/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteProfile = function (id) {
  const options = {
    url: this.apiPath('profiles/' + id),
    method: 'DELETE'
  };

  return this.callApi(options);
};

ApiHttp.prototype.searchValidations = function (body) {
  const options = {
    url: this.apiPath('validations/_search'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.getUser = function (id) {
  const options = {
    url: this.apiPath('users/' + id),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.getUserRights = function (id) {
  const options = {
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
  const options = {
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
  const options = {
    url: this.apiPath('users/' + id + '/_create'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.createRestrictedUser = function (body, id) {
  const options = {
    url: this.apiPath('users/' + id + '/_createRestricted'),
    method: 'POST',
    body
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateSelf = function (body) {
  const options = {
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
  const options = {
    url: this.apiPath(index + '/' + collection + '/_specifications'),
    method: 'GET'
  };

  return this.callApi(options);
};

ApiHttp.prototype.updateSpecifications = function (specifications) {
  const options = {
    url: this.apiPath('_specifications'),
    method: 'PUT',
    body: specifications
  };

  return this.callApi(options);
};

ApiHttp.prototype.validateSpecifications = function (specifications) {
  const options = {
    url: this.apiPath('_validateSpecifications'),
    method: 'POST',
    body: specifications
  };

  return this.callApi(options);
};

ApiHttp.prototype.validateDocument = function (index, collection, document) {
  const options = {
    url: this.apiPath(index + '/' + collection + '/_validate'),
    method: 'POST',
    body: document
  };

  return this.callApi(options);
};

ApiHttp.prototype.postDocument = function (index, collection, document) {
  const options = {
    url: this.apiPath(index + '/' + collection + '/_create'),
    method: 'POST',
    body: document
  };

  return this.callApi(options);
};

ApiHttp.prototype.deleteSpecifications = function (index, collection) {
  const options = {
    url: this.apiPath(index + '/' + collection + '/_specifications'),
    method: 'DELETE'
  };

  return this.callApi(options);
};

module.exports = ApiHttp;
