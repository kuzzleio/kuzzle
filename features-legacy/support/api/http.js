'use strict';

const zlib = require('zlib');

const _ = require('lodash');
const rp = require('request-promise');

const routes = require('../../../lib/api/httpRoutes');

function checkAlgorithm (algorithm) {
  const
    supported = ['identity', 'gzip', 'deflate'],
    list = algorithm.split(',').map(a => a.trim().toLowerCase());

  for (const l of list) {
    if (! supported.some(a => a === l)) {
      throw new Error(`Unsupported compression algorithm: ${l}`);
    }
  }
}

class HttpApi {
  constructor (world) {
    this.world = world;

    this.baseUri = `http://${world.config.host}:${world.config.port}`;

    this.util = {
      getIndex: index => typeof index !== 'string' ? this.world.fakeIndex : index,
      getCollection: collection => typeof collection !== 'string' ? this.world.fakeCollection : collection
    };

    this.isRealtimeCapable = false;

    this.encoding = 'identity';
    this.expectedEncoding = 'identity';
  }

  _getRequest (index, collection, controller, action, args) {
    let
      url = '',
      queryString = [],
      verb = 'GET',
      result;

    if (! args) {
      args = {};
    }
    if (! args.body) {
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
              if (! index) {
                throw new Error('No index provided');
              }
              return index;
            }
            if (match === ':collection') {
              if (! collection) {
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

              if (value !== undefined) {
                if (Array.isArray(value)) {
                  queryString.push(...value.map(v => `${key}=${v}`));
                }
                else {
                  queryString.push(`${key}=${value}`);
                }
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
  }

  apiBasePath (path) {
    return this.apiPath(path);
  }

  apiPath (path) {
    return path.startsWith('/')
      ? encodeURI(`${this.baseUri}${path}`)
      : encodeURI(`${this.baseUri}/${path}`);
  }

  adminResetDatabase () {
    const options = {
      url: this.apiPath('/admin/_resetDatabase/'),
      method: 'POST'
    };

    return this.callApi(options);
  }

  serverPublicApi () {
    const options = {
      url: this.apiPath('/_publicApi'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  bulkImport (bulk, index) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/_bulk'),
      method: 'POST',
      body: { bulkData: bulk }
    };

    return this.callApi(options);
  }

  bulkMWrite (index, collection, body) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mWrite'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  bulkWrite (index, collection, body, _id = null) {
    let url = `${this.util.getIndex(index)}/${this.util.getCollection(collection)}/_write`;

    if (_id) {
      url += `?_id=${_id}`;
    }

    const options = {
      url: this.apiPath(url),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  /**
   * @param options
   * @returns {Promise.<IncomingMessage>}
   */
  async callApi (options) {
    if (! options.headers) {
      options.headers = {};
    }

    if (this.world.currentUser && this.world.currentUser.token) {
      options.headers = _.extend(options.headers, {
        authorization: `Bearer ${this.world.currentUser.token}`,
      });
    }

    if (options.body && this.encoding !== 'identity') {
      options.body = JSON.stringify(options.body);
      options.headers['content-encoding'] = this.encoding;

      const algorithms = this.encoding.split(',').map(a => a.trim().toLowerCase());

      for (const algorithm of algorithms) {
        if (algorithm === 'gzip') {
          options.body = zlib.gzipSync(options.body);
        }
        else if (algorithm === 'deflate') {
          options.body = zlib.deflateSync(options.body);
        }
      }
    }
    else {
      options.json = true;
    }

    if (this.expectedEncoding !== 'identity') {
      options.headers['accept-encoding'] = this.expectedEncoding;

      // despite the name, that options asks "request" to handle
      // both gzip or deflate compressed responses
      options.gzip = true;
    }

    options.forever = true;

    const response = await rp(options);

    // we need to manually parse the stringified json if
    // we sent a compressed buffer through the request module
    if (options.body && this.encoding !== 'identity') {
      return JSON.parse(response);
    }

    return response;
  }

  callMemoryStorage (command, args) {
    return this.callApi(this._getRequest(null, null, 'ms', command, args));
  }

  checkToken (token) {
    let _token = null;
    const request = {
      url: this.apiPath('_checkToken'),
      method: 'POST',
      body: { token }
    };

    if (this.world.currentUser && this.world.currentUser.token) {
      _token = this.world.currentUser.token;
      this.world.currentUser.token = null;
    }

    return this.callApi(request)
      .then(response => {
        if (_token !== null) {
          this.world.currentUser.token = _token;
        }

        return response;
      })
      .catch(error => {
        if (_token !== null) {
          this.world.currentUser.token = _token;
        }

        return Promise.reject(error);
      });
  }

  collectionExists (index, collection) {
    return this.callApi(this._getRequest(index, collection, 'collection', 'exists'));
  }

  count (query, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_count'),
      method: 'POST',
      body: query
    };

    return this.callApi(options);
  }

  create (body, index, collection, jwtToken, id) {
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
  }

  createCollection (index, collection, mappings) {
    index = index || this.world.fakeIndex;

    const options = {
      url: this.apiPath(`${index}/${collection}`),
      method: 'PUT',
      body: mappings
    };

    return this.callApi(options);
  }

  getCollectionMapping (index, collection, includeKuzzleMeta = false) {
    const url = `${index}/${collection}/_mapping${includeKuzzleMeta ? '?includeKuzzleMeta' : ''}`;

    const options = {
      url: this.apiPath(url),
      method: 'GET'
    };

    return this.callApi(options);
  }

  createCredentials (strategy, userId, body) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/' + userId + '/_create'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  createFirstAdmin (body, id, reset) {
    const options = {
      url: this.apiPath('_createFirstAdmin'),
      method: 'POST',
      body
    };

    if (id !== undefined) {
      options.url = this.apiPath(`_createFirstAdmin/${id}`);
    }

    if (reset) {
      options.url += '?reset=1';
    }

    return this.callApi(options);
  }

  createIndex (index) {
    const options = {
      url: this.apiPath(index + '/_create'),
      method: 'POST'
    };

    return this.callApi(options);
  }

  createMyCredentials (strategy, body) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/_me/_create'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  createOrReplace (body, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/' + body._id),
      method: 'PUT',
      body
    };

    delete body._id;

    return this.callApi(options);
  }

  createOrReplaceProfile (id, body) {
    const options = {
      url: this.apiPath('profiles/' + id),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  createOrReplaceRole (id, body) {
    const options = {
      url: this.apiPath('roles/' + id),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  createRestrictedUser (body, id) {
    const options = {
      url: this.apiPath('users/' + id + '/_createRestricted'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  createUser (body, id) {
    const options = {
      url: this.apiPath('users/' + id + '/_create' + '?refresh=wait_for'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  credentialsExist (strategy) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/_me/_exists'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  deleteById (id, index) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/' + id),
      method: 'DELETE'
    };

    return this.callApi(options);
  }

  deleteByQuery (query, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_query'),
      method: 'DELETE',
      body: query
    };

    return this.callApi(options);
  }

  deleteCredentials (strategy, userId) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/' + userId),
      method: 'DELETE'
    };

    return this.callApi(options);
  }

  deleteIndex (index) {
    const options = {
      url: this.apiPath(index),
      method: 'DELETE'
    };

    return this.callApi(options);
  }

  deleteIndexes () {
    const options = {
      url: this.apiPath('_mDelete'),
      method: 'DELETE'
    };

    return this.callApi(options);
  }

  deleteMyCredentials (strategy) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/_me'),
      method: 'DELETE'
    };

    return this.callApi(options);
  }

  deleteProfile (id, waitFor = false) {
    return this.callApi({
      url: this.apiPath('profiles/' + id + (waitFor ? '?refresh=wait_for' : '')),
      method: 'DELETE'
    });
  }

  deleteProfiles (ids, waitFor = false) {
    return this.callApi({
      url: this.apiPath('profiles/_mDelete' + (waitFor ? '?refresh=wait_for' : '')),
      method: 'POST',
      body: {
        ids
      }
    });
  }

  deleteRole (id, waitFor = false) {
    return this.callApi({
      url: this.apiPath('roles/' + id + (waitFor ? '?refresh=wait_for' : '')),
      method: 'DELETE'
    });
  }

  deleteRoles (ids, waitFor = false) {
    return this.callApi({
      url: this.apiPath('roles/_mDelete' + (waitFor ? '?refresh=wait_for' : '')),
      method: 'POST',
      body: {
        ids
      }
    });
  }

  deleteSpecifications (index, collection) {
    const options = {
      url: this.apiPath(index + '/' + collection + '/_specifications'),
      method: 'DELETE'
    };

    return this.callApi(options);
  }

  deleteUser (id, waitFor = false) {
    return this.callApi({
      url: this.apiPath('users/' + id + (waitFor ? '?refresh=wait_for' : '')),
      method: 'DELETE'
    });
  }

  deleteUsers (ids, waitFor = false) {
    return this.callApi({
      url: this.apiPath('users/_mDelete' + (waitFor ? '?refresh=wait_for' : '')),
      method: 'POST',
      body: {
        ids
      }
    });
  }

  disconnect () {}

  exists (id, index) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/' + id + '/_exists'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  get (id, index) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/' + id),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getAllStats () {
    const options = {
      url: this.apiPath('_getAllStats'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getAuthenticationStrategies () {
    const options = {
      url: this.apiPath('strategies'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getCredentials (strategy, userId) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/' + userId),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getCredentialsById (strategy, userId) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/' + userId + '/_byId'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getCurrentUser () {
    return this.callApi({
      url: this.apiPath('users/_me'),
      method: 'GET'
    });
  }

  getLastStats () {
    const options = {
      url: this.apiPath('_getLastStats'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getMyCredentials (strategy) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/_me'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getMyRights () {
    const options = {
      url: this.apiPath('users/_me/_rights'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getProfile (id) {
    const options = {
      url: this.apiPath('profiles/' + id),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getProfileMapping () {
    const options = {
      url: this.apiPath('/profiles/_mapping'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getProfileRights (id) {
    const options = {
      url: this.apiPath('profiles/' + id + '/_rights'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getRole (id) {
    const options = {
      url: this.apiPath('roles/' + id),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getRoleMapping () {
    const options = {
      url: this.apiPath('/roles/_mapping'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getSpecifications (index, collection) {
    const options = {
      url: this.apiPath(index + '/' + collection + '/_specifications'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getStats (dates) {
    return this.callApi(this._getRequest(null, null, 'server', 'getStats', { body: dates }));
  }

  getUser (id) {
    const options = {
      url: this.apiPath('users/' + id),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getUserMapping () {
    const options = {
      url: this.apiPath('/users/_mapping'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  getUserRights (id) {
    const options = {
      url: this.apiPath('users/' + id + '/_rights'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  hasCredentials (strategy, userId) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/' + userId + '/_exists'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  indexExists (index) {
    return this.callApi(this._getRequest(index, null, 'index', 'exists'));
  }

  refreshCollection (index, collection) {
    const
      _index = index || this.world.fakeIndex,
      _collection = collection || this.world.fakeCollection,
      options = {
        url: this.apiPath(`${_index}/${_collection}/_refresh`),
        method: 'POST'
      };

    return this.callApi(options);
  }

  listCollections (index, type) {
    const options = {
      url: this.apiPath(`${index || this.world.fakeIndex}/_list`),
      method: 'GET'
    };
    if (type) {
      options.url += '?type=' + type;
    }

    return this.callApi(options);
  }

  listIndexes () {
    const options = {
      url: this.apiPath('_list'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  login (strategy, credentials) {
    const options = {
      url: this.apiPath(`_login/${strategy}`),
      method: 'POST',
      body: {
        username: credentials.username,
        password: credentials.password
      }
    };

    return this.callApi(options);
  }

  logout (jwtToken) {
    const options = {
      url: this.apiPath('_logout'),
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + jwtToken
      }
    };

    return this.callApi(options);
  }

  mCreate (body, index, collection, jwtToken) {
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
  }

  mCreateOrReplace (body, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mCreateOrReplace'),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  mDelete (body, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mDelete'),
      method: 'DELETE',
      body
    };

    return this.callApi(options);
  }

  mGet (body, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mGet'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  mGetProfiles (body) {
    const options = {
      url: this.apiPath('profiles/_mGet'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  mGetRoles (body) {
    const options = {
      url: this.apiPath('roles/_mGet'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  mReplace (body, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mReplace'),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  mUpdate (body, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_mUpdate'),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  now () {
    const options = {
      url: this.apiPath('_now'),
      method: 'GET'
    };

    return this.callApi(options);
  }

  postDocument (index, collection, document) {
    const options = {
      url: this.apiPath(index + '/' + collection + '/_create'),
      method: 'POST',
      body: document
    };

    return this.callApi(options);
  }

  publish (body, index) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.world.fakeCollection + '/_publish'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  refreshToken () {
    return this.callApi({
      url: this.apiPath('_refreshToken'),
      method: 'POST'
    });
  }

  replace (body, index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/' + body._id + '/_replace'),
      method: 'PUT',
      body
    };

    delete body._id;

    return this.callApi(options);
  }

  replaceUser (id, body) {
    return this.callApi({
      url: this.apiPath('users/' + id + '/_replace'),
      method: 'PUT',
      body
    });
  }

  revokeTokens (id) {
    return this.callApi({
      url: this.apiPath(`users/${id}/tokens`),
      method: 'DELETE'
    });
  }

  scroll (scrollId, scroll) {
    const options = {
      url: this.apiPath(`_scroll/${scrollId}`),
      method: 'GET'
    };

    if (scroll) {
      options.url += '?scroll=' + scroll;
    }

    return this.callApi(options);
  }

  scrollProfiles (scrollId) {
    const options = {
      url: this.apiPath('profiles/_scroll/' + scrollId),
      method: 'GET'
    };

    return this.callApi(options);
  }

  scrollSpecifications (scrollId) {
    const options = {
      url: this.apiPath('validations/_scroll/' + scrollId),
      method: 'GET'
    };

    return this.callApi(options);
  }

  scrollUsers (scrollId) {
    const options = {
      url: this.apiPath('users/_scroll/' + scrollId),
      method: 'GET'
    };

    return this.callApi(options);
  }

  search (query, index, collection, args) {
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

      options.url += qs.join('&');
    }

    return this.callApi(options);
  }

  searchProfiles (roles, args) {
    const options = {
      url: this.apiPath('profiles/_search'),
      method: 'POST',
      body: {
        roles
      }
    };

    if (args) {
      let first = true;
      Object.keys(args).forEach(arg => {
        options.url += (first ? '?' : '&') + `${arg}=${args[arg]}`;
        first = false;
      });
    }

    return this.callApi(options);
  }

  searchRoles (body, args) {
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

      options.url += qs.join('&');
    }

    return this.callApi(options);
  }

  searchSpecifications (body, args) {
    const options = {
      url: this.apiPath('validations/_search'),
      method: 'POST',
      body
    };

    if (args) {
      let first = true;
      Object.keys(args).forEach(arg => {
        options.url += (first ? '?' : '&') + `${arg}=${args[arg]}`;
        first = false;
      });
    }

    return this.callApi(options);
  }

  searchUsers (query, args) {
    const options = {
      url: this.apiPath('users/_search'),
      method: 'POST',
      body: {
        query
      }
    };

    if (args) {
      let first = true;
      Object.keys(args).forEach(arg => {
        options.url += (first ? '?' : '&') + `${arg}=${args[arg]}`;
        first = false;
      });
    }

    return this.callApi(options);
  }

  truncateCollection (index, collection) {
    const options = {
      url: this.apiPath(this.util.getIndex(index) + '/' + this.util.getCollection(collection) + '/_truncate'),
      method: 'DELETE'
    };

    return this.callApi(options);
  }

  update (id, body, index, collection) {
    const
      _collection = collection || this.world.fakeCollection,
      options = {
        url: this.apiPath(`${this.util.getIndex(index)}/${_collection}/${id}/_update`),
        method: 'PUT',
        body
      };

    delete body._id;

    return this.callApi(options);
  }

  updateCredentials (strategy, userId, body) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/' + userId + '/_update'),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  updateProfileMapping () {
    const options = {
      url: this.apiPath('/profiles/_mapping'),
      method: 'PUT',
      body: this.world.securitymapping
    };

    return this.callApi(options);
  }

  updateMapping (index, collection, mapping) {
    const options = {
      url: `${this.apiPath(this.util.getIndex(index))}/${collection || this.world.fakeCollection}/_mapping`,
      method: 'PUT',
      body: mapping || this.world.mapping
    };

    return this.callApi(options);
  }

  updateMyCredentials (strategy, body) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/_me/_update'),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  updateRoleMapping () {
    const options = {
      url: this.apiPath('/roles/_mapping'),
      method: 'PUT',
      body: this.world.securitymapping
    };

    return this.callApi(options);
  }

  updateSelf (body) {
    const options = {
      url: this.apiPath('_updateSelf'),
      method: 'PUT',
      body
    };

    return this.callApi(options);
  }

  updateSpecifications (index, collection, specifications) {
    const options = {
      url: this.apiPath(`${index}/${collection}/_specifications`),
      method: 'PUT',
      body: specifications
    };

    return this.callApi(options);
  }

  updateUserMapping () {
    const options = {
      url: this.apiPath('/users/_mapping'),
      method: 'PUT',
      body: this.world.securitymapping
    };

    return this.callApi(options);
  }

  validateCredentials (strategy, userId, body) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/' + userId + '/_validate'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  validateDocument (index, collection, document) {
    const options = {
      url: this.apiPath(index + '/' + collection + '/_validate'),
      method: 'POST',
      body: document
    };

    return this.callApi(options);
  }

  validateMyCredentials (strategy, body) {
    const options = {
      url : this.apiPath('credentials/' + strategy + '/_me/_validate'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  validateSpecifications (index, collection, specifications) {
    const options = {
      url: this.apiPath(index ? `${index}/${collection}/_validateSpecifications` : '_validateSpecifications'),
      method: 'POST',
      body: specifications
    };

    return this.callApi(options);
  }

  resetCache (database) {
    const options = {
      url: this.apiPath(`admin/_resetCache/${database}`),
      method: 'POST'
    };

    return this.callApi(options);
  }

  resetKuzzleData () {
    const options = {
      url: this.apiPath('admin/_resetKuzzleData'),
      method: 'POST'
    };

    return this.callApi(options);
  }

  resetSecurity () {
    const options = {
      url: this.apiPath('admin/_resetSecurity'),
      method: 'POST',
      body: {
        refresh: 'wait_for'
      }
    };

    return this.callApi(options);
  }

  resetDatabase () {
    const options = {
      url: this.apiPath('admin/_resetDatabase'),
      method: 'POST'
    };

    return this.callApi(options);
  }

  loadMappings (body) {
    const options = {
      url : this.apiPath('admin/_loadMappings?refresh=wait_for'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  loadFixtures (body) {
    const options = {
      url : this.apiPath('admin/_loadFixtures?refresh=wait_for'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  loadSecurities (body) {
    const options = {
      url : this.apiPath('admin/_loadSecurities?refresh=wait_for'),
      method: 'POST',
      body
    };

    return this.callApi(options);
  }

  encode (algorithm) {
    checkAlgorithm(algorithm);
    this.encoding = algorithm;
  }

  decode (algorithm) {
    checkAlgorithm(algorithm);
    this.expectedEncoding = algorithm;
  }

  urlEncodedCreate (form) {
    return this.callApi({
      form,
      method: 'POST',
      url: this.apiPath(`${this.world.fakeIndex}/${this.world.fakeCollection}/_create`),
    });
  }

  multipartCreate (formData) {
    return this.callApi({
      formData,
      method: 'POST',
      url: this.apiPath(`${this.world.fakeIndex}/${this.world.fakeCollection}/_create`),
    });
  }
}

module.exports = HttpApi;
