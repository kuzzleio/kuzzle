/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

module.exports = [
  // GET (idempotent)
  {action: 'getCurrentUser', controller: 'auth', url: '/users/_me', verb: 'get'},
  {action: 'getMyCredentials', controller: 'auth', url: '/credentials/:strategy/_me', verb: 'get'},
  {action: 'credentialsExist', controller: 'auth', url: '/credentials/:strategy/_me/_exists', verb: 'get'},
  {action: 'getMyRights', controller: 'auth', url: '/users/_me/_rights', verb: 'get'},
  {action: 'getStrategies', controller: 'auth', url: '/strategies', verb: 'get'},

  // We need to expose a GET method for "login" action in order to make authentication protocol like Oauth2 or CAS work:
  {action: 'login', controller: 'auth', url: '/_login/:strategy', verb: 'get'},

  {action: 'exists', controller: 'collection', url: '/:index/:collection/_exists', verb: 'get'},
  {action: 'getMapping', controller: 'collection', url: '/:index/:collection/_mapping', verb: 'get'},
  {action: 'getSpecifications', controller: 'collection', url: '/:index/:collection/_specifications', verb: 'get'},
  {action: 'scrollSpecifications', controller: 'collection', url: '/validations/_scroll/:scrollId', verb: 'get'},
  {action: 'list', controller: 'collection', url: '/:index/_list', verb: 'get'},

  {action: 'resetCache', controller: 'admin', url: '/admin/_resetCache', verb: 'post'},
  {action: 'resetSecurity', controller: 'admin', url: '/admin/_resetSecurity', verb: 'post'},
  {action: 'resetDatabase', controller: 'admin', url: '/admin/_resetDatabase', verb: 'post'},
  {action: 'resetKuzzleData', controller: 'admin', url: '/admin/_resetKuzzleData', verb: 'post'},
  {action: 'dump', controller: 'admin', url: '/admin/_dump', verb: 'post'},
  {action: 'shutdown', controller: 'admin', url: '/admin/_shutdown/', verb: 'post'},
  {action: 'loadFixtures', controller: 'admin', url: '/admin/_loadFixtures', verb: 'post'},
  {action: 'loadMappings', controller: 'admin', url: '/admin/_loadMappings', verb: 'post'},
  {action: 'loadSecurities', controller: 'admin', url: '/admin/_loadSecurities', verb: 'post'},

  {action: 'search', controller: 'document', url: '/:index/:collection', verb: 'get'},
  {action: 'get', controller: 'document', url: '/:index/:collection/:_id', verb: 'get'},
  {action: 'mGet', controller: 'document', url: '/:index/:collection/_mGet', verb: 'get'},
  {action: 'exists', controller: 'document', url: '/:index/:collection/:_id/_exists', verb: 'get'},
  {action: 'scroll', controller: 'document', url: '/_scroll/:scrollId', verb: 'get'},

  {action: 'exists', controller: 'index', url: '/:index/_exists', verb: 'get'},
  {action: 'getAutoRefresh', controller: 'index', url: '/:index/_autoRefresh', verb: 'get'},
  {action: 'list', controller: 'index', url: '/_list', verb: 'get'},

  {action: 'list', controller: 'realtime', url: '/_listSubscriptions', verb: 'get'},

  {action: 'getProfile', controller: 'security', url: '/profiles/:_id', verb: 'get'},
  {action: 'getProfileRights', controller: 'security', url: '/profiles/:_id/_rights', verb: 'get'},
  {action: 'getRole', controller: 'security', url: '/roles/:_id', verb: 'get'},
  {action: 'getUser', controller: 'security', url: '/users/:_id', verb: 'get'},
  {action: 'getUserRights', controller: 'security', url: '/users/:_id/_rights', verb: 'get'},
  {action: 'getProfileMapping', controller: 'security', url: '/profiles/_mapping', verb: 'get'},
  {action: 'getRoleMapping', controller: 'security', url: '/roles/_mapping', verb: 'get'},
  {action: 'getUserMapping', controller: 'security', url: '/users/_mapping', verb: 'get'},
  {action: 'scrollUsers', controller: 'security', url: '/users/_scroll/:scrollId', verb: 'get'},
  {action: 'getCredentials', controller: 'security', url: '/credentials/:strategy/:_id', verb: 'get'},
  {action: 'getCredentialsById', controller: 'security', url: '/credentials/:strategy/:_id/_byId', verb: 'get'},
  {action: 'hasCredentials', controller: 'security', url: '/credentials/:strategy/:_id/_exists', verb: 'get'},
  {action: 'getCredentialFields', controller: 'security', url: '/credentials/:strategy/_fields', verb: 'get'},
  {action: 'getAllCredentialFields', controller: 'security', url: '/credentials/_fields', verb: 'get'},
  {action: 'scrollProfiles', controller: 'security', url: '/profiles/_scroll/:scrollId', verb: 'get'},

  {action: 'adminExists', controller: 'server', url: '/_adminExists', verb: 'get'},
  {action: 'getAllStats', controller: 'server', url: '/_getAllStats', verb: 'get'},
  {action: 'getConfig', controller: 'server', url: '/_getConfig', verb: 'get'},
  {action: 'getLastStats', controller: 'server', url: '/_getLastStats', verb: 'get'},
  {action: 'getStats', controller: 'server', url: '/_getStats', verb: 'get'},
  {action: 'info', controller: 'server', url: '/', verb: 'get'},
  {action: 'healthCheck', controller: 'server', url: '/_healthCheck', verb: 'get'},
  {action: 'info', controller: 'server', url: '/_serverInfo', verb: 'get'},
  {action: 'now', controller: 'server', url: '/_now', verb: 'get'},
  {action: 'publicApi', controller: 'server', url: '/_publicApi', verb: 'get'},

  {action: 'bitcount', controller: 'ms', url: '/ms/_bitcount/:_id', verb: 'get'},
  {action: 'bitpos', controller: 'ms', url: '/ms/_bitpos/:_id', verb: 'get'},
  {action: 'dbsize', controller: 'ms', url: '/ms/_dbsize', verb: 'get'},
  {action: 'getbit', controller: 'ms', url: '/ms/_getbit/:_id', verb: 'get'},
  {action: 'getrange', controller: 'ms', url: '/ms/_getrange/:_id', verb: 'get'},
  {action: 'exists', controller: 'ms', url: '/ms/_exists', verb: 'get'},
  {action: 'geodist', controller: 'ms', url: '/ms/_geodist/:_id/:member1/:member2', verb: 'get'},
  {action: 'geohash', controller: 'ms', url: '/ms/_geohash/:_id', verb: 'get'},
  {action: 'geopos', controller: 'ms', url: '/ms/_geopos/:_id', verb: 'get'},
  {action: 'georadius', controller: 'ms', url: '/ms/_georadius/:_id', verb: 'get'},
  {action: 'georadiusbymember', controller: 'ms', url: '/ms/_georadiusbymember/:_id', verb: 'get'},
  {action: 'hexists', controller: 'ms', url: '/ms/_hexists/:_id/:field', verb: 'get'},
  {action: 'hget', controller: 'ms', url: '/ms/_hget/:_id/:field', verb: 'get'},
  {action: 'hgetall', controller: 'ms', url: '/ms/_hgetall/:_id', verb: 'get'},
  {action: 'hkeys', controller: 'ms', url: '/ms/_hkeys/:_id', verb: 'get'},
  {action: 'hlen', controller: 'ms', url: '/ms/_hlen/:_id', verb: 'get'},
  {action: 'hmget', controller: 'ms', url: '/ms/_hmget/:_id', verb: 'get'},
  {action: 'hscan', controller: 'ms', url: '/ms/_hscan/:_id', verb: 'get'},
  {action: 'hstrlen', controller: 'ms', url: '/ms/_hstrlen/:_id/:field', verb: 'get'},
  {action: 'hvals', controller: 'ms', url: '/ms/_hvals/:_id', verb: 'get'},
  {action: 'keys', controller: 'ms', url: '/ms/_keys/:pattern', verb: 'get'},
  {action: 'lindex', controller: 'ms', url: '/ms/_lindex/:_id/:idx', verb: 'get'},
  {action: 'llen', controller: 'ms', url: '/ms/_llen/:_id', verb: 'get'},
  {action: 'lrange', controller: 'ms', url: '/ms/_lrange/:_id', verb: 'get'},
  {action: 'mget', controller: 'ms', url: '/ms/_mget', verb: 'get'},
  {action: 'object', controller: 'ms', url: '/ms/_object/:_id', verb: 'get'},
  {action: 'pfcount', controller: 'ms', url: '/ms/_pfcount', verb: 'get'},
  {action: 'ping', controller: 'ms', url: '/ms/_ping', verb: 'get'},
  {action: 'pttl', controller: 'ms', url: '/ms/_pttl/:_id', verb: 'get'},
  {action: 'randomkey', controller: 'ms', url: '/ms/_randomkey', verb: 'get'},
  {action: 'scan', controller: 'ms', url: '/ms/_scan', verb: 'get'},
  {action: 'scard', controller: 'ms', url: '/ms/_scard/:_id', verb: 'get'},
  {action: 'sdiff', controller: 'ms', url: '/ms/_sdiff/:_id', verb: 'get'},
  {action: 'sinter', controller: 'ms', url: '/ms/_sinter', verb: 'get'},
  {action: 'sismember', controller: 'ms', url: '/ms/_sismember/:_id/:member', verb: 'get'},
  {action: 'smembers', controller: 'ms', url: '/ms/_smembers/:_id', verb: 'get'},
  {action: 'srandmember', controller: 'ms', url: '/ms/_srandmember/:_id', verb: 'get'},
  {action: 'sscan', controller: 'ms', url: '/ms/_sscan/:_id', verb: 'get'},
  {action: 'strlen', controller: 'ms', url: '/ms/_strlen/:_id', verb: 'get'},
  {action: 'sunion', controller: 'ms', url: '/ms/_sunion', verb: 'get'},
  {action: 'time', controller: 'ms', url: '/ms/_time', verb: 'get'},
  {action: 'ttl', controller: 'ms', url: '/ms/_ttl/:_id', verb: 'get'},
  {action: 'type', controller: 'ms', url: '/ms/_type/:_id', verb: 'get'},
  {action: 'zcard', controller: 'ms', url: '/ms/_zcard/:_id', verb: 'get'},
  {action: 'zcount', controller: 'ms', url: '/ms/_zcount/:_id', verb: 'get'},
  {action: 'zlexcount', controller: 'ms', url: '/ms/_zlexcount/:_id', verb: 'get'},
  {action: 'zrange', controller: 'ms', url: '/ms/_zrange/:_id', verb: 'get'},
  {action: 'zrangebylex', controller: 'ms', url: '/ms/_zrangebylex/:_id', verb: 'get'},
  {action: 'zrevrangebylex', controller: 'ms', url: '/ms/_zrevrangebylex/:_id', verb: 'get'},
  {action: 'zrangebyscore', controller: 'ms', url: '/ms/_zrangebyscore/:_id', verb: 'get'},
  {action: 'zrank', controller: 'ms', url: '/ms/_zrank/:_id/:member', verb: 'get'},
  {action: 'zrevrange', controller: 'ms', url: '/ms/_zrevrange/:_id', verb: 'get'},
  {action: 'zrevrangebyscore', controller: 'ms', url: '/ms/_zrevrangebyscore/:_id', verb: 'get'},
  {action: 'zrevrank', controller: 'ms', url: '/ms/_zrevrank/:_id/:member', verb: 'get'},
  {action: 'zscan', controller: 'ms', url: '/ms/_zscan/:_id', verb: 'get'},
  {action: 'zscore', controller: 'ms', url: '/ms/_zscore/:_id/:member', verb: 'get'},
  {action: 'get', controller: 'ms', url: '/ms/:_id', verb: 'get'},


  // POST
  {action: 'login', controller: 'auth', url: '/_login/:strategy', verb: 'post'},
  {action: 'logout', controller: 'auth', url: '/_logout', verb: 'post'},
  {action: 'checkToken', controller: 'auth', url: '/_checkToken', verb: 'post'},
  {action: 'refreshToken', controller: 'auth', url: '/_refreshToken', verb: 'post'},
  {action: 'createMyCredentials', controller: 'auth', url: '/credentials/:strategy/_me/_create', verb: 'post'},
  {action: 'validateMyCredentials', controller: 'auth', url: '/credentials/:strategy/_me/_validate', verb: 'post'},

  {action: 'validateSpecifications', controller: 'collection', url: '/:index/:collection/_validateSpecifications', verb: 'post'},
  {action: 'searchSpecifications', controller: 'collection', url: '/validations/_search', verb: 'post'},

  {action: 'import', controller: 'bulk', url: '/:index/:collection/_bulk', verb: 'post'},

  {action: 'mWrite', controller: 'bulk', url: '/:index/:collection/_mWrite', verb: 'post'},
  {action: 'write', controller: 'bulk', url: '/:index/:collection/_write', verb: 'post'},

  {action: 'refresh', controller: 'collection', url: '/:index/:collection/_refresh', verb: 'post' },
  {action: 'refresh', controller: 'security', url: '/_security/:collection/_refresh', verb: 'post' },

  {action: 'create', controller: 'index', url: '/:index/_create', verb: 'post'},

  {action: 'count', controller: 'document', url: '/:index/:collection/_count', verb: 'post'},
  {action: 'create', controller: 'document', url: '/:index/:collection/_create', verb: 'post'},
  {action: 'create', controller: 'document', url: '/:index/:collection/:_id/_create', verb: 'post'},
  {action: 'publish', controller: 'realtime', url: '/:index/:collection/_publish', verb: 'post'},
  {action: 'search', controller: 'document', url: '/:index/:collection/_search', verb: 'post'},
  {action: 'mGet', controller: 'document', url: '/:index/:collection/_mGet', verb: 'post'},
  {action: 'mCreate', controller: 'document', url: '/:index/:collection/_mCreate', verb: 'post'},
  {action: 'validate', controller: 'document', url: '/:index/:collection/_validate', verb: 'post'},

  {action: 'createFirstAdmin', controller: 'security', url: '/_createFirstAdmin/:_id', verb: 'post'},
  {action: 'createFirstAdmin', controller: 'security', url: '/_createFirstAdmin', verb: 'post'},

  {action: 'createCredentials', controller: 'security', url: '/credentials/:strategy/:_id/_create', verb: 'post'},
  {action: 'createProfile', controller: 'security', url: '/profiles/:_id/_create', verb: 'post'},
  {action: 'createRole', controller: 'security', url: '/roles/:_id/_create', verb: 'post'},
  {action: 'createRestrictedUser', controller: 'security', url: '/users/_createRestricted', verb: 'post'},
  {action: 'createRestrictedUser', controller: 'security', url: '/users/:_id/_createRestricted', verb: 'post'},
  {action: 'createUser', controller: 'security', url: '/users/_create', verb: 'post'},
  {action: 'createUser', controller: 'security', url: '/users/:_id/_create', verb: 'post'},
  {action: 'mDeleteProfiles', controller: 'security', url: '/profiles/_mDelete', verb: 'post'},
  {action: 'mDeleteRoles', controller: 'security', url: '/roles/_mDelete', verb: 'post'},
  {action: 'mDeleteUsers', controller: 'security', url: '/users/_mDelete', verb: 'post'},
  {action: 'mGetProfiles', controller: 'security', url: '/profiles/_mGet', verb: 'post'},
  {action: 'mGetRoles', controller: 'security', url: '/roles/_mGet', verb: 'post'},
  {action: 'searchProfiles', controller: 'security', url: '/profiles/_search', verb: 'post'},
  {action: 'searchRoles', controller: 'security', url: '/roles/_search', verb: 'post'},
  {action: 'searchUsers', controller: 'security', url: '/users/_search', verb: 'post'},
  {action: 'validateCredentials', controller: 'security', url: '/credentials/:strategy/:_id/_validate', verb: 'post'},

  {action: 'createApiKey', controller: 'security', url: '/users/:userId/api-keys/_create', verb: 'post'},
  {action: 'searchApiKeys', controller: 'security', url: '/users/:userId/api-keys/_search', verb: 'post'},

  {action: 'createApiKey', controller: 'auth', url: '/api-keys/_create', verb: 'post'},
  {action: 'searchApiKeys', controller: 'auth', url: '/api-keys/_search', verb: 'post'},

  {action: 'append', controller: 'ms', url: '/ms/_append/:_id', verb: 'post'},
  {action: 'bgrewriteaof', controller: 'ms', url: '/ms/_bgrewriteaof', verb: 'post'},
  {action: 'bgsave', controller: 'ms', url: '/ms/_bgsave', verb: 'post'},
  {action: 'bitop', controller: 'ms', url: '/ms/_bitop/:_id', verb: 'post'},
  {action: 'decr', controller: 'ms', url: '/ms/_decr/:_id', verb: 'post'},
  {action: 'decrby', controller: 'ms', url: '/ms/_decrby/:_id', verb: 'post'},
  {action: 'expire', controller: 'ms', url: '/ms/_expire/:_id', verb: 'post'},
  {action: 'expireat', controller: 'ms', url: '/ms/_expireat/:_id', verb: 'post'},
  {action: 'flushdb', controller: 'ms', url: '/ms/_flushdb', verb: 'post'},
  {action: 'geoadd', controller: 'ms', url: '/ms/_geoadd/:_id', verb: 'post'},
  {action: 'getset', controller: 'ms', url: '/ms/_getset/:_id', verb: 'post'},
  {action: 'hincrby', controller: 'ms', url: '/ms/_hincrby/:_id', verb: 'post'},
  {action: 'hincrbyfloat', controller: 'ms', url: '/ms/_hincrbyfloat/:_id', verb: 'post'},
  {action: 'hmset', controller: 'ms', url: '/ms/_hmset/:_id', verb: 'post'},
  {action: 'hset', controller: 'ms', url: '/ms/_hset/:_id', verb: 'post'},
  {action: 'hsetnx', controller: 'ms', url: '/ms/_hsetnx/:_id', verb: 'post'},
  {action: 'incr', controller: 'ms', url: '/ms/_incr/:_id', verb: 'post'},
  {action: 'incrby', controller: 'ms', url: '/ms/_incrby/:_id', verb: 'post'},
  {action: 'incrbyfloat', controller: 'ms', url: '/ms/_incrbyfloat/:_id', verb: 'post'},
  {action: 'linsert', controller: 'ms', url: '/ms/_linsert/:_id', verb: 'post'},
  {action: 'lpop', controller: 'ms', url: '/ms/_lpop/:_id', verb: 'post'},
  {action: 'lpush', controller: 'ms', url: '/ms/_lpush/:_id', verb: 'post'},
  {action: 'lpushx', controller: 'ms', url: '/ms/_lpushx/:_id', verb: 'post'},
  {action: 'lset', controller: 'ms', url: '/ms/_lset/:_id', verb: 'post'},
  {action: 'ltrim', controller: 'ms', url: '/ms/_ltrim/:_id', verb: 'post'},
  {action: 'mset', controller: 'ms', url: '/ms/_mset', verb: 'post'},
  {action: 'msetnx', controller: 'ms', url: '/ms/_msetnx', verb: 'post'},
  {action: 'persist', controller: 'ms', url: '/ms/_persist/:_id', verb: 'post'},
  {action: 'pexpire', controller: 'ms', url: '/ms/_pexpire/:_id', verb: 'post'},
  {action: 'pexpireat', controller: 'ms', url: '/ms/_pexpireat/:_id', verb: 'post'},
  {action: 'pfadd', controller: 'ms', url: '/ms/_pfadd/:_id', verb: 'post'},
  {action: 'pfmerge', controller: 'ms', url: '/ms/_pfmerge/:_id', verb: 'post'},
  {action: 'psetex', controller: 'ms', url: '/ms/_psetex/:_id', verb: 'post'},
  {action: 'rename', controller: 'ms', url: '/ms/_rename/:_id', verb: 'post'},
  {action: 'renamenx', controller: 'ms', url: '/ms/_renamenx/:_id', verb: 'post'},
  {action: 'rpop', controller: 'ms', url: '/ms/_rpop/:_id', verb: 'post'},
  {action: 'rpoplpush', controller: 'ms', url: '/ms/_rpoplpush', verb: 'post'},
  {action: 'rpush', controller: 'ms', url: '/ms/_rpush/:_id', verb: 'post'},
  {action: 'rpushx', controller: 'ms', url: '/ms/_rpushx/:_id', verb: 'post'},
  {action: 'sadd', controller: 'ms', url: '/ms/_sadd/:_id', verb: 'post'},
  {action: 'sdiffstore', controller: 'ms', url: '/ms/_sdiffstore/:_id', verb: 'post'},
  {action: 'set', controller: 'ms', url: '/ms/_set/:_id', verb: 'post'},
  {action: 'setex', controller: 'ms', url: '/ms/_setex/:_id', verb: 'post'},
  {action: 'setnx', controller: 'ms', url: '/ms/_setnx/:_id', verb: 'post'},
  {action: 'sinterstore', controller: 'ms', url: '/ms/_sinterstore', verb: 'post'},
  {action: 'smove', controller: 'ms', url: '/ms/_smove/:_id', verb: 'post'},
  {action: 'sort', controller: 'ms', url: '/ms/_sort/:_id', verb: 'post'},
  {action: 'spop', controller: 'ms', url: '/ms/_spop/:_id', verb: 'post'},
  {action: 'sunionstore', controller: 'ms', url: '/ms/_sunionstore', verb: 'post'},
  {action: 'touch', controller: 'ms', url: '/ms/_touch', verb: 'post'},
  {action: 'zadd', controller: 'ms', url: '/ms/_zadd/:_id', verb: 'post'},
  {action: 'zincrby', controller: 'ms', url: '/ms/_zincrby/:_id', verb: 'post'},
  {action: 'zinterstore', controller: 'ms', url: '/ms/_zinterstore/:_id', verb: 'post'},
  {action: 'zunionstore', controller: 'ms', url: '/ms/_zunionstore/:_id', verb: 'post'},


  // DELETE
  {action: 'deleteMyCredentials', controller: 'auth', url: '/credentials/:strategy/_me', verb: 'delete'},

  {action: 'deleteSpecifications', controller: 'collection', url: '/:index/:collection/_specifications', verb: 'delete'},
  {action: 'truncate', controller: 'collection', url: '/:index/:collection/_truncate', verb: 'delete'},

  {action: 'delete', controller: 'document', url: '/:index/:collection/:_id', verb: 'delete'},
  {action: 'deleteByQuery', controller: 'document', url: '/:index/:collection/_query', verb: 'delete'},
  {action: 'mDelete', controller: 'document', url: '/:index/:collection/_mDelete', verb: 'delete'},

  {action: 'delete', controller: 'index', url: '/:index', verb: 'delete'},
  {action: 'mDelete', controller: 'index', url: '/_mdelete', verb: 'delete'},

  {action: 'delete', controller: 'collection', url: '/:index/:collection', verb: 'delete'},

  {action: 'deleteProfile', controller: 'security', url: '/profiles/:_id', verb: 'delete'},
  {action: 'deleteRole', controller: 'security', url: '/roles/:_id', verb: 'delete'},
  {action: 'deleteUser', controller: 'security', url: '/users/:_id', verb: 'delete'},
  {action: 'deleteCredentials', controller: 'security', url: '/credentials/:strategy/:_id', verb: 'delete'},
  {action: 'revokeTokens', controller: 'security', url: '/users/:_id/tokens', verb: 'delete'},

  {action: 'del', controller: 'ms', url: '/ms', verb: 'delete'},
  {action: 'hdel', controller: 'ms', url: '/ms/_hdel/:_id', verb: 'delete'},
  {action: 'lrem', controller: 'ms', url: '/ms/_lrem/:_id', verb: 'delete'},
  {action: 'srem', controller: 'ms', url: '/ms/_srem/:_id', verb: 'delete'},
  {action: 'zrem', controller: 'ms', url: '/ms/_zrem/:_id', verb: 'delete'},
  {action: 'zremrangebylex', controller: 'ms', url: '/ms/_zremrangebylex/:_id', verb: 'delete'},
  {action: 'zremrangebyrank', controller: 'ms', url: '/ms/_zremrangebyrank/:_id', verb: 'delete'},
  {action: 'zremrangebyscore', controller: 'ms', url: '/ms/_zremrangebyscore/:_id', verb: 'delete'},

  {action: 'deleteApiKey', controller: 'security', url: '/users/:userId/api-keys/:_id', verb: 'delete'},
  {action: 'deleteApiKey', controller: 'auth', url: '/api-keys/:_id', verb: 'delete'},


  // PUT (idempotent)
  {action: 'updateSelf', controller: 'auth', url: '/_updateSelf', verb: 'put'},
  {action: 'updateMyCredentials', controller: 'auth', url: '/credentials/:strategy/_me/_update', verb: 'put'},

  {action: 'create', controller: 'collection', url: '/:index/:collection', verb: 'put'},
  {action: 'update', controller: 'collection', url: '/:index/:collection', verb: 'post'},
  {action: 'updateMapping', controller: 'collection', url: '/:index/:collection/_mapping', verb: 'put'},

  {action: 'updateSpecifications', controller: 'collection', url: '/:index/:collection/_specifications', verb: 'put'},

  {action: 'createOrReplace', controller: 'document', url: '/:index/:collection/:_id', verb: 'put'},
  {action: 'mCreateOrReplace', controller: 'document', url: '/:index/:collection/_mCreateOrReplace', verb: 'put'},
  {action: 'replace', controller: 'document', url: '/:index/:collection/:_id/_replace', verb: 'put'},
  {action: 'mReplace', controller: 'document', url: '/:index/:collection/_mReplace', verb: 'put'},
  {action: 'mUpdate', controller: 'document', url: '/:index/:collection/_mUpdate', verb: 'put'},
  {action: 'update', controller: 'document', url: '/:index/:collection/:_id/_update', verb: 'put'},

  {action: 'createOrReplaceProfile', controller: 'security', url: '/profiles/:_id', verb: 'put'},
  {action: 'createOrReplaceRole', controller: 'security', url: '/roles/:_id', verb: 'put'},
  {action: 'updateCredentials', controller: 'security', url: '/credentials/:strategy/:_id/_update', verb: 'put'},
  {action: 'updateProfile', controller: 'security', url: '/profiles/:_id/_update', verb: 'put'},
  {action: 'updateRole', controller: 'security', url: '/roles/:_id/_update', verb: 'put'},
  {action: 'updateUser', controller: 'security', url: '/users/:_id/_update', verb: 'put'},
  {action: 'replaceUser', controller: 'security', url: '/users/:_id/_replace', verb: 'put'},
  {action: 'updateProfileMapping', controller: 'security', url: '/profiles/_mapping', verb: 'put'},
  {action: 'updateRoleMapping', controller: 'security', url: '/roles/_mapping', verb: 'put'},
  {action: 'updateUserMapping', controller: 'security', url: '/users/_mapping', verb: 'put'}
];
