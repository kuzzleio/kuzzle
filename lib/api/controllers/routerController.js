var
  _ = require('lodash'),
  q = require('q'),
  url = require('url'),
  stringify = require('json-stable-stringify'),
  Router = require('router'),
  bodyParser = require('body-parser'),
  finalhandler = require('finalhandler'),
  RequestObject = require('../core/models/requestObject'),
  ResponseObject = require('../core/models/responseObject'),
  PluginImplementationError = require('../core/errors/pluginImplementationError'),
  BadRequestError = require('../core/errors/badRequestError'),
  routes;

var contentTypeCheck = function (request, response, next) {
  var
    errorObject,
    isError = false,
    match = /application\/json(; charset=([a-z0-9A-Z\-]*))?/.exec(request.headers['content-type']);

  next = next || function () {};

  if (request.headers['content-type']) {
    if (match === null) {
      isError = true;
      errorObject = new ResponseObject(request, new BadRequestError('Invalid request content-type. Expected "application/json", got: "' + request.headers['content-type'] + '"'));
    } else if (match[2] !== undefined && match[2].toLowerCase() !== 'utf-8') {
      isError = true;
      errorObject = new ResponseObject(request, new BadRequestError('Charset of the Request content-type must be utf-8. Expected "application/json; charset=utf-8", got: "' + request.headers['content-type'] + '"'));
    }

    if (isError) {
      response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
      response.end(stringify(errorObject.toJson()));
      return false;
    }
  }
  next();
  return true;
};

module.exports = function RouterController (kuzzle) {
  this.router = null;
  this.pluginRouter = null;
  this.routename = 'kuzzle';
  this.kuzzle = kuzzle;
  this.connections = {};

  /**
   * Declares a new connection on a given protocol. Called by protocol plugins.
   * Returns a context object to be used with router.execute() and router.removeConnection()
   *
   * @param {string} protocol - protocol name
   * @param {string} connectionId - unique connection identifier
   * @return {promise} connection context, to be used with other router functions
   */
  this.newConnection = function (protocol, connectionId) {
    var error;

    if (!connectionId || !protocol || typeof connectionId !== 'string' || typeof protocol !== 'string') {
      error = new PluginImplementationError('Rejected new connection declaration: invalid arguments');
      kuzzle.pluginsManager.trigger('log:error', error);
      return q.reject(error);
    }

    if (!this.connections[connectionId]) {
      this.connections[connectionId] = {
        connection: {type: protocol, id: connectionId},
        token: null
      };
    }

    kuzzle.statistics.newConnection(this.connections[connectionId]);

    return q(this.connections[connectionId]);
  };

  /**
   * Called by protocol plugins: forward a received request to Kuzzle.
   * Resolves a callback with the corresponding controller response
   *
   * A note about the JWT headers: if this value is falsey, if no "authorization" field is found, if the token is not
   * properly formatted or if the token itself is invalid, then the corresponding user will automatically
   * be set to "anonymous".
   *
   * @param {Object} requestObject - the request to execute
   * @param {String} context - connection context, obtained using the newConnection() method
   * @return {Promise} ResponseObject
   */
  this.execute = function (requestObject, context, callback) {
    var error;

    if (!requestObject) {
      error = new PluginImplementationError('Request execution error: no provided request');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(new ResponseObject(requestObject, error));
    }

    if (!context || !context.connection) {
      error = new PluginImplementationError('Unable to execute request: ' + requestObject +
        '\nReason: invalid context. Use context.getRouter().newConnection() to get a valid context.');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(new ResponseObject(requestObject, error));
    }

    if (!context.connection.id || !this.connections[context.connection.id]) {
      error = new PluginImplementationError('Unable to execute request: unknown context. ' +
        'Has context.getRouter().newConnection() been called before executing requests?');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(new ResponseObject(requestObject, error));
    }

    kuzzle.funnel.execute(requestObject, context, (err, response) => {
      if (err) {
        kuzzle.pluginsManager.trigger('log:error', err);
        return callback(err);
      }

      callback(null, response);
    });
  };

  /**
   * Called by protocol plugins: removes a connection from the connection pool.
   * @param {object} context - connection context, obtained using the newConnection() method
   */
  this.removeConnection = function (context) {
    if (context.connection.id && this.connections[context.connection.id]) {
      delete this.connections[context.connection.id];
      kuzzle.hotelClerk.removeCustomerFromAllRooms(context.connection);
      kuzzle.statistics.dropConnection(context.connection);
    }
    else {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection: ' +
        JSON.stringify(context) + '.\nReason: unknown context'));
    }
  };

  /**
   * Initializes the HTTP routes for the Kuzzle REST API.
   */
  this.initRouterHttp = function () {
    var
      apiBase = new Router(),
      api = new Router(),
      coverage;

    routes = [
      {verb: 'get', url: '/_logout', controller: 'auth', action: 'logout'},
      {verb: 'get', url: '/_getLastStats', controller: 'admin', action: 'getLastStats'},
      {verb: 'get', url: '/_getAllStats', controller: 'admin', action: 'getAllStats'},
      {verb: 'get', url: '/_login/:strategy', controller: 'auth', action: 'login'},
      {verb: 'get', url: '/_now', controller: 'read', action: 'now'},
      {verb: 'get', url: '/_listIndexes', controller: 'read', action: 'listIndexes'},
      {verb: 'get', url: '/_listSubscriptions', controller: 'subscribe', action: 'list'},
      {verb: 'get', url: '/roles/:id', controller: 'security', action: 'getRole'},
      {verb: 'get', url: '/profiles/:id', controller: 'security', action: 'getProfile'},
      {verb: 'get', url: '/:index/_listCollections', controller: 'read', action: 'listCollections'},
      {verb: 'get', url: '/:index/_listCollections/:type', controller: 'read', action: 'listCollections'},
      {verb: 'get', url: '/:index/:collection/_mapping', controller: 'admin', action: 'getMapping'},
      {verb: 'get', url: '/:index/_autoRefresh', controller: 'admin', action: 'getAutoRefresh'},
      {verb: 'get', url: '/users/_me', controller: 'auth', action: 'getCurrentUser'},
      {verb: 'get', url: '/users/:id', controller: 'security', action: 'getUser'},
      {verb: 'get', url: '/ms/_bitpos/:id/:bit', controller: 'ms', action: 'bitpos'},
      {verb: 'get', url: '/ms/_dbsize', controller: 'ms', action: 'dbsize'},
      {verb: 'get', url: '/ms/_dump/:id', controller: 'ms', action: 'dump'},
      {verb: 'get', url: '/ms/_getbit/:id/:offset', controller: 'ms', action: 'getbit'},
      {verb: 'get', url: '/ms/_getrange/:id/:start/:end', controller: 'ms', action: 'getrange'},
      {verb: 'get', url: '/ms/_exists/:id', controller: 'ms', action: 'exists'},
      {verb: 'get', url: '/ms/_geohash/:id/:member', controller: 'ms', action: 'geohash'},
      {verb: 'get', url: '/ms/_geopos/:id/:member', controller: 'ms', action: 'geopos'},
      {verb: 'get', url: '/ms/_goedist/:id/:member1/:member2', controller: 'ms', action: 'geodist'},
      {verb: 'get', url: '/ms/_georadius/:id', controller: 'ms', action: 'georadius'},
      {verb: 'get', url: '/ms/_georadiusbymember/:id', controller: 'ms', action: 'georadiusbymember'},
      {verb: 'get', url: '/ms/_hget/:id/:field', controller: 'ms', action: 'hget'},
      {verb: 'get', url: '/ms/_hgetall/:id', controller: 'ms', action: 'hgetall'},
      {verb: 'get', url: '/ms/_hkeys/:id', controller: 'ms', action: 'hkeys'},
      {verb: 'get', url: '/ms/_hlen/:id', controller: 'ms', action: 'hlen'},
      {verb: 'get', url: '/ms/_hmget/:id/:field', controller: 'ms', action: 'hmget'},
      {verb: 'get', url: '/ms/_hstrlen/:id/:field', controller: 'ms', action: 'hstrlen'},
      {verb: 'get', url: '/ms/_hvals/:id', controller: 'ms', action: 'hvals'},
      {verb: 'get', url: '/ms/_info/:section', controller: 'ms', action: 'info'},
      {verb: 'get', url: '/ms/_info', controller: 'ms', action: 'info'},
      {verb: 'get', url: '/ms/_keys/:pattern', controller: 'ms', action: 'keys'},
      {verb: 'get', url: '/ms/_lastsave', controller: 'ms', action: 'lastsave'},
      {verb: 'get', url: '/ms/_lindex/:id/:idx', controller: 'ms', action: 'lindex'},
      {verb: 'get', url: '/ms/_llen/:id', controller: 'ms', action: 'llen'},
      {verb: 'get', url: '/ms/_lrange/:id/:start/:stop', controller: 'ms', action: 'lrange'},
      {verb: 'get', url: '/ms/_mget/:id', controller: 'ms', action: 'mget'},
      {verb: 'get', url: '/ms/_mget', controller: 'ms', action: 'mget'},
      {verb: 'get', url: '/ms/_object', controller: 'ms', action: 'object'},
      {verb: 'get', url: '/ms/_pfcount/:id', controller: 'ms', action: 'pfcount'},
      {verb: 'get', url: '/ms/_pfcount', controller: 'ms', action: 'pfcount'},
      {verb: 'get', url: '/ms/_ping', controller: 'ms', action: 'ping'},
      {verb: 'get', url: '/ms/_pttl/:id', controller: 'ms', action: 'pttl'},
      {verb: 'get', url: '/ms/_randomkey', controller: 'ms', action: 'randomkey'},
      {verb: 'get', url: '/ms/_scard/:id', controller: 'ms', action: 'scard'},
      {verb: 'get', url: '/ms/_sdiff/:id', controller: 'ms', action: 'sdiff'},
      {verb: 'get', url: '/ms/_sinter/:id', controller: 'ms', action: 'sinter'},
      {verb: 'get', url: '/ms/_sismember/:id/:member', controller: 'ms', action: 'sismember'},
      {verb: 'get', url: '/ms/_smembers/:id', controller: 'ms', action: 'smembers'},
      {verb: 'get', url: '/ms/_srandmember/:id/:count', controller: 'ms', action: 'srandmember'},
      {verb: 'get', url: '/ms/_srandmember/:id', controller: 'ms', action: 'srandmember'},
      {verb: 'get', url: '/ms/_strlen/:id', controller: 'ms', action: 'strlen'},
      {verb: 'get', url: '/ms/_time', controller: 'ms', action: 'time'},
      {verb: 'get', url: '/ms/_ttl/:id', controller: 'ms', action: 'ttl'},
      {verb: 'get', url: '/ms/_type/:id', controller: 'ms', action: 'type'},
      {verb: 'get', url: '/ms/_zcard/:id', controller: 'ms', action: 'zcard'},
      {verb: 'get', url: '/ms/_zcount/:id/:min/:max', controller: 'ms', action: 'zcount'},
      {verb: 'get', url: '/ms/_zlexcount/:id/:min/:max', controller: 'ms', action: 'zlexcount'},
      {verb: 'get', url: '/ms/_zrange/:id/:start/:stop', controller: 'ms', action: 'zrange'},
      {verb: 'get', url: '/ms/_zrangebylex/:id/:min/:max', controller: 'ms', action: 'zrangebylex'},
      {verb: 'get', url: '/ms/_zrevrangebylex/:id/:min/:max', controller: 'ms', action: 'zrevrangebylex'},
      {verb: 'get', url: '/ms/_zrangebyscore/:id/:min/:max', controller: 'ms', action: 'zrangebyscore'},
      {verb: 'get', url: '/ms/_zrank/:id/:member', controller: 'ms', action: 'zrank'},
      {verb: 'get', url: '/ms/_zrevrange/:id/:start/:stop', controller: 'ms', action: 'zrevrange'},
      {verb: 'get', url: '/ms/_zrevrangebyscore/:id/:max/:min', controller: 'ms', action: 'zrevrangebyscore'},
      {verb: 'get', url: '/ms/_zrevrank/:id/:member', controller: 'ms', action: 'zrevrank'},
      {verb: 'get', url: '/ms/_zscore/:id/:member', controller: 'ms', action: 'zscore'},
      {verb: 'get', url: '/ms/:id', controller: 'ms', action: 'get'},
      {verb: 'get', url: '/:index/:collection/:id', controller: 'read', action: 'get'},

      {verb: 'post', url: '/_bulk', controller: 'bulk', action: 'import'},
      {verb: 'post', url: '/_getStats', controller: 'admin', action: 'getStats'},
      {verb: 'post', url: '/roles/_search', controller: 'security', action: 'searchRoles'},
      {verb: 'post', url: '/roles/_mget', controller: 'security', action: 'mGetRoles'},
      {verb: 'post', url: '/roles/_create', controller: 'security', action: 'createRole'},
      {verb: 'post', url: '/roles/:id', controller: 'security', action: 'updateRole'},
      {verb: 'post', url: '/profiles/_search', controller: 'security', action: 'searchProfiles'},
      {verb: 'post', url: '/profiles/_mget', controller: 'security', action: 'mGetProfiles'},
      {verb: 'post', url: '/profiles/_create', controller: 'security', action: 'createProfile'},
      {verb: 'post', url: '/profiles/:id', controller: 'security', action: 'updateProfile'},
      {verb: 'post', url: '/users/_search', controller: 'security', action: 'searchUsers'},
      {verb: 'post', url: '/users/_create', controller: 'security', action: 'createUser'},
      {verb: 'post', url: '/users/:id', controller: 'security', action: 'updateUser'},
      {verb: 'post', url: '/_login', controller: 'auth', action: 'login'},
      {verb: 'post', url: '/_checkToken', controller: 'auth', action: 'checkToken'},
      {verb: 'post', url: '/_login/:strategy', controller: 'auth', action: 'login'},
      {verb: 'post', url: '/ms/_append/:id', controller: 'ms', action: 'append'},
      {verb: 'post', url: '/ms/_bgrewriteaof', controller: 'ms', action: 'bgrewriteaof'},
      {verb: 'post', url: '/ms/_bgsave', controller: 'ms', action: 'bgsave'},
      {verb: 'post', url: '/ms/_bitop/:operation/:destkey/:key', controller: 'ms', action: 'bitop'},
      {verb: 'post', url: '/ms/_bitop/:operation/:destkey', controller: 'ms', action: 'bitop'},
      {verb: 'post', url: '/ms/_blpop', controller: 'ms', action: 'blpop'},
      {verb: 'post', url: '/ms/_blpop/:id', controller: 'ms', action: 'blpop'},
      {verb: 'post', url: '/ms/_brpop', controller: 'ms', action: 'brpop'},
      {verb: 'post', url: '/ms/_brpop/:id', controller: 'ms', action: 'brpop'},
      {verb: 'post', url: '/ms/_brpoplpush', controller: 'ms', action: 'brpoplpush'},
      {verb: 'post', url: '/ms/_decr/:id', controller: 'ms', action: 'decr'},
      {verb: 'post', url: '/ms/_decrby/:id', controller: 'ms', action: 'decrby'},
      {verb: 'post', url: '/ms/_discard', controller: 'ms', action: 'discard'},
      {verb: 'post', url: '/ms/_exec', controller: 'ms', action: 'exec'},
      {verb: 'post', url: '/ms/_expire/:id', controller: 'ms', action: 'expire'},
      {verb: 'post', url: '/ms/_expireat/:id', controller: 'ms', action: 'expireat'},
      {verb: 'post', url: '/ms/_flushdb', controller: 'ms', action: 'flushdb'},
      {verb: 'post', url: '/ms/_geoadd/:id', controller: 'ms', action: 'geoadd'},
      {verb: 'post', url: '/ms/_getset/:id', controller: 'ms', action: 'getset'},
      {verb: 'post', url: '/ms/_hincrby/:id', controller: 'ms', action: 'hincrby'},
      {verb: 'post', url: '/ms/_hincrbyfloat/:id', controller: 'ms', action: 'hincrbyfloat'},
      {verb: 'post', url: '/ms/_hmset/:id', controller: 'ms', action: 'hmset'},
      {verb: 'post', url: '/ms/_hset/:id', controller: 'ms', action: 'hset'},
      {verb: 'post', url: '/ms/_hsetnx/:id', controller: 'ms', action: 'hsetnx'},
      {verb: 'post', url: '/ms/_incr/:id', controller: 'ms', action: 'incr'},
      {verb: 'post', url: '/ms/_incrby/:id', controller: 'ms', action: 'incrby'},
      {verb: 'post', url: '/ms/_incrbyfloat/:id', controller: 'ms', action: 'incrbyfloat'},
      {verb: 'post', url: '/ms/_linsert/:id', controller: 'ms', action: 'linsert'},
      {verb: 'post', url: '/ms/_lpop/:id', controller: 'ms', action: 'lpop'},
      {verb: 'post', url: '/ms/_lpush/:id', controller: 'ms', action: 'lpush'},
      {verb: 'post', url: '/ms/_lpushx/:id', controller: 'ms', action: 'lpushx'},
      {verb: 'post', url: '/ms/_lset/:id', controller: 'ms', action: 'lset'},
      {verb: 'post', url: '/ms/_ltrim/:id', controller: 'ms', action: 'ltrim'},
      {verb: 'post', url: '/ms/_mset/:id', controller: 'ms', action: 'mset'},
      {verb: 'post', url: '/ms/_mset', controller: 'ms', action: 'mset'},
      {verb: 'post', url: '/ms/_msetnx', controller: 'ms', action: 'msetnx'},
      {verb: 'post', url: '/ms/_multi', controller: 'ms', action: 'multi'},
      {verb: 'post', url: '/ms/_persist/:id', controller: 'ms', action: 'persist'},
      {verb: 'post', url: '/ms/_pexpire/:id', controller: 'ms', action: 'pexpire'},
      {verb: 'post', url: '/ms/_pexpireat/:id', controller: 'ms', action: 'pexpireat'},
      {verb: 'post', url: '/ms/_pfadd/:id', controller: 'ms', action: 'pfadd'},
      {verb: 'post', url: '/ms/_pfmerge', controller: 'ms', action: 'pfmerge'},
      {verb: 'post', url: '/ms/_psetex/:id', controller: 'ms', action: 'psetex'},
      {verb: 'post', url: '/ms/_psetex', controller: 'ms', action: 'psetex'},
      {verb: 'post', url: '/ms/_publish/:channel', controller: 'ms', action: 'publish'},
      {verb: 'post', url: '/ms/_rename/:id', controller: 'ms', action: 'rename'},
      {verb: 'post', url: '/ms/_renamenx/:id', controller: 'ms', action: 'renamenx'},
      {verb: 'post', url: '/ms/_restore/:id', controller: 'ms', action: 'restore'},
      {verb: 'post', url: '/ms/_rpop/:id', controller: 'ms', action: 'rpop'},
      {verb: 'post', url: '/ms/_rpoplpush', controller: 'ms', action: 'rpoplpush'},
      {verb: 'post', url: '/ms/_rpush/:id', controller: 'ms', action: 'rpush'},
      {verb: 'post', url: '/ms/_rpushx/:id', controller: 'ms', action: 'rpushx'},
      {verb: 'post', url: '/ms/_sadd/:id', controller: 'ms', action: 'sadd'},
      {verb: 'post', url: '/ms/_save', controller: 'ms', action: 'save'},
      {verb: 'post', url: '/ms/_sdiffstore/:id', controller: 'ms', action: 'sdiffstore'},
      {verb: 'post', url: '/ms/_sdiffstore', controller: 'ms', action: 'sdiffstore'},
      {verb: 'post', url: '/ms/_setbit/:id', controller: 'ms', action: 'setbit'},
      {verb: 'post', url: '/ms/_setex/:id', controller: 'ms', action: 'setex'},
      {verb: 'post', url: '/ms/_setnx/:id', controller: 'ms', action: 'setnx'},
      {verb: 'post', url: '/ms/_setrange/:id', controller: 'ms', action: 'setrange'},
      {verb: 'post', url: '/ms/_sinterstore/:id', controller: 'ms', action: 'sinterstore'},
      {verb: 'post', url: '/ms/_smove/:id', controller: 'ms', action: 'smove'},
      {verb: 'post', url: '/ms/_smove', controller: 'ms', action: 'smove'},
      {verb: 'post', url: '/ms/_sort/:id', controller: 'ms', action: 'sort'},
      {verb: 'post', url: '/ms/_spop/:id', controller: 'ms', action: 'spop'},
      {verb: 'post', url: '/ms/_sunion/:id', controller: 'ms', action: 'sunion'},
      {verb: 'post', url: '/ms/_sunionstore/:id', controller: 'ms', action: 'sunionstore'},
      {verb: 'post', url: '/ms/_zadd/:id', controller: 'ms', action: 'zadd'},
      {verb: 'post', url: '/ms/_zincrby/:id', controller: 'ms', action: 'zincrby'},
      {verb: 'post', url: '/ms/_zinterstore', controller: 'ms', action: 'zinterstore'},
      {verb: 'post', url: '/ms/_zunionstore', controller: 'ms', action: 'zunionstore'},
      {verb: 'post', url: '/ms/:id', controller: 'ms', action: 'set'},
      {verb: 'post', url: '/:index/_bulk', controller: 'bulk', action: 'import'},
      {verb: 'post', url: '/:index/_refresh', controller: 'admin', action: 'refreshIndex'},
      {verb: 'post', url: '/:index/_autoRefresh', controller: 'admin', action: 'setAutoRefresh'},
      {verb: 'post', url: '/:index/:collection/_bulk', controller: 'bulk', action: 'import'},
      {verb: 'post', url: '/:index/:collection/_search', controller: 'read', action: 'search'},
      {verb: 'post', url: '/:index/:collection/_count', controller: 'read', action: 'count'},
      {verb: 'post', url: '/:index/:collection/_create', controller: 'write', action: 'create'},
      {verb: 'post', url: '/:index/:collection', controller: 'write', action: 'publish'},

      {verb: 'delete', url: '/_deleteIndexes', controller: 'admin', action: 'deleteIndexes'},
      {verb: 'delete', url: '/roles/:id', controller: 'security', action: 'deleteRole'},
      {verb: 'delete', url: '/profiles/:id', controller: 'security', action: 'deleteProfile'},
      {verb: 'delete', url: '/users/:id', controller: 'security', action: 'deleteUser'},
      {verb: 'delete', url: '/ms/_hdel/:id', controller: 'ms', action: 'hdel'},
      {verb: 'delete', url: '/ms/_hdel/:id', controller: 'ms', action: 'hdel'},
      {verb: 'delete', url: '/ms/_lrem/:id', controller: 'ms', action: 'lrem'},
      {verb: 'delete', url: '/ms/_srem/:id', controller: 'ms', action: 'srem'},
      {verb: 'delete', url: '/ms/_zrem/:id', controller: 'ms', action: 'zrem'},
      {verb: 'delete', url: '/ms/_zremrangebylex/:id', controller: 'ms', action: 'zremrangebylex'},
      {verb: 'delete', url: '/ms/_zremrangebyscore/:id', controller: 'ms', action: 'zremrangebyscore'},
      {verb: 'delete', url: '/ms/:id', controller: 'ms', action: 'del'},
      {verb: 'delete', url: '/ms', controller: 'ms', action: 'del'},
      {verb: 'delete', url: '/:index', controller: 'admin', action: 'deleteIndex'},
      {verb: 'delete', url: '/:index/:collection/_query', controller: 'write', action: 'deleteByQuery'},
      {verb: 'delete', url: '/:index/:collection/_truncate', controller: 'admin', action: 'truncateCollection'},
      {verb: 'delete', url: '/:index/:collection/:id', controller: 'write', action: 'delete'},

      {verb: 'put', url: '/roles/:id', controller: 'security', action: 'createOrReplaceRole'},
      {verb: 'put', url: '/roles/:id/_createOrReplace', controller: 'security', action: 'createOrReplaceRole'},
      {verb: 'put', url: '/profiles/:id', controller: 'security', action: 'createOrReplaceProfile'},
      {verb: 'put', url: '/profiles/:id/_createOrReplace', controller: 'security', action: 'createOrReplaceProfile'},
      {verb: 'put', url: '/users/:id', controller: 'security', action: 'createOrReplaceUser'},
      {verb: 'put', url: '/:index', controller: 'admin', action: 'createIndex'},
      {verb: 'put', url: '/:index/:collection', controller: 'write', action: 'createCollection'},
      {verb: 'put', url: '/:index/:collection/_mapping', controller: 'admin', action: 'updateMapping'},
      {verb: 'put', url: '/:index/:collection/:id/_:action', controller: 'write'},
      {verb: 'put', url: '/:index/:collection/:id', controller: 'write', action: 'createOrReplace'}
    ];
    routes = routes.concat(kuzzle.pluginsManager.routes);

    this.router = new Router();

    this.router.use(contentTypeCheck);

    // create and mount a new router for the coverage API
    if (process.env.FEATURE_COVERAGE === '1') {
      coverage = require('istanbul-middleware');
      this.router.use('/coverage', coverage.createHandler({resetOnGet: true}));
    }

    // create and mount a new router for our API
    this.router.use('/api', apiBase);
    this.router.use('/api/' + kuzzle.config.apiVersion, api);

    /*
     Registering the basic _serverInfo route
     This route is also used to get Kuzzle API Version, so it isn't registered under api/<version> but
     directly under api/
     */
    apiBase.get('/_serverInfo', (request, response) => {
      executeFromRest.call(kuzzle, {controller: 'read', action: 'serverInfo'}, request, response);
    });

    // create and mount a new router for plugins
    this.pluginRouter = new Router();
    api.use('/_plugin', this.pluginRouter);

    // add a body parsing middleware to our API
    api.use(bodyParser.json());

    // Simple hello world to let know to the user that kuzzle is running
    api.get('/', (request, response) => {
      var _routes = {};

      routes.forEach((route) =>{
        if (_routes[route.controller] === undefined) {
          _routes[route.controller] = {};
        }
        if (_routes[route.controller][route.verb] === undefined) {
          _routes[route.controller][route.verb] = [];
        }
        _routes[route.controller][route.verb].push('/api/' + kuzzle.config.apiVersion + route.url);
      });

      response.writeHead('Access-Control-Allow-Origin', '*');
      response.writeHead('Access-Control-Allow-Headers', 'X-Requested-With');
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(stringify({status: 200, error: null, result: {message: 'Available routes for this API version by verb.', routes: _routes}}));
    });

    // Register API routes
    routes.forEach(route => {
      api[route.verb](route.url, function (request, response) {
        var params = {
          controller: route.controller
        };

        if (route.action) {
          params.action = route.action;
        }

        executeFromRest.call(kuzzle, params, request, response);
      });
    });
  };

  /**
   * Forward incoming REST requests to the HTTP routes created by the
   * initRouterHttp function.
   *
   * @param request transmitted through the REST API
   * @param response is the HTTP connection handler
   */
  this.routeHttp = function (request, response) {
    kuzzle.pluginsManager.trigger('log:silly', 'Handle HTTP request');

    this.router(request, response, finalhandler(request, response));
  };

  /**
   * Handles requests coming from MQ protocols: AMQP, MQTT & STOMP
   *
   */
  this.routeMQListener = function () {
    kuzzle.services.list.mqBroker.listenExchange(this.routename, function handleMQMessage(msg) {
      var
        context = {
          connection: null,
          user: null
        },
        data,
        requestObject,
        rawContent;

      if (!(msg.content instanceof Buffer)) {
        rawContent = msg.content.toString();
      }
      else {
        rawContent = (new Buffer(msg.content)).toString();
      }

      try {
        data = JSON.parse(rawContent);
      }
      catch (e) {
        kuzzle.pluginsManager.trigger('log:error', {message: 'Parse error', error: e});
        return false;
      }

      kuzzle.pluginsManager.trigger('log:silly', 'Handle MQ input' + msg.fields.routingKey);

      // For MQTT messages, we do not have a replyTo header like with AMQP or STOMP
      // => MQTT client has to send its mqtt client id and subscribe to the topic exchange mqtt.<clientId>
      //    to get feedback from Kuzzle.
      if (msg.properties && msg.properties.replyTo) {
        context.connection = {type: 'amq', id: data.clientId};
      }
      else {
        context.connection = {type: 'mqtt', id: data.clientId};
      }

      requestObject = new RequestObject(data, {}, 'mq');

      kuzzle.funnel.execute(requestObject, context, (error, responseObject) => {
        if (error) {
          kuzzle.pluginsManager.trigger('log:error', error);
          if (context.connection.type === 'amq') {
            kuzzle.services.list.mqBroker.replyTo(msg.properties.replyTo, error.toJson());
          }
          else {
            kuzzle.services.list.mqBroker.addExchange('mqtt.' + context.connection.id, error.toJson());
          }

          return false;
        }

        if (context.connection.type === 'amq') {
          kuzzle.services.list.mqBroker.replyTo(msg.properties.replyTo, responseObject.toJson());
        }
        else {
          kuzzle.services.list.mqBroker.addExchange('mqtt.' + context.connection.id, responseObject.toJson());
        }
      });
    });
  };
};

/**
 * Transmit HTTP requests to the funnel controller and forward its response back to
 * the client
 *
 * @param params contains the request metadata
 * @param request is the original request from the client
 * @param response is the HTTP connection handler
 */
function executeFromRest(params, request, response) {
  var
    requestObject,
    errorObject,
    data,
    queryParams,
    additionalData,
    context = {
      connection: {
        type: 'rest',
        id: ''
      },
      token: null
    };

  if (!params.controller) {
    errorObject = new ResponseObject(request, new BadRequestError('The "controller" argument is missing'));
    response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
    response.end(stringify(errorObject.toJson()));
    return false;
  }

  if (!contentTypeCheck(request, response)) {
    return false;
  }

  data = {
    controller: params.controller,
    action: params.action || request.params.action,
    collection: request.params.collection,
    headers: request.headers
  };

  if (request.params.action) {
    delete request.params.action;
  }
  if (request.params.collection) {
    delete request.params.collection;
  }
  if (request.params.id) {
    data._id = request.params.id;
    delete request.params.id;
  }

  if (request.params.index) {
    data.index = request.params.index;
    delete request.params.index;
  }

  _.forEach(request.params, function (value, param) {
    request.body[param] = value;
  });

  queryParams = url.parse(request.originalUrl, true);
  additionalData = _.merge(request.body, queryParams.query);
  requestObject = new RequestObject(data, additionalData, 'rest');

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');

  this.funnel.execute(requestObject, context, (error, responseObject) => {
    if (error) {
      this.pluginsManager.trigger('log:error', error);
      response.writeHead(error.status, {'Content-Type': 'application/json'});
      response.end(stringify(error.toJson()));
    } else {
      response.writeHead(responseObject.status, {'Content-Type': 'application/json'});
      response.end(stringify(responseObject.toJson()));
    }
  });
}
