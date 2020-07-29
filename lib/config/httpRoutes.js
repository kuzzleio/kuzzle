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

/* eslint sort-keys: 0 */

'use strict';

module.exports = [
  // GET (idempotent)
  {verb: 'get', url: '/_me', controller: 'auth', action: 'getCurrentUser'},
  {verb: 'get', url: '/_me/_rights', controller: 'auth', action: 'getMyRights'},
  {verb: 'get', url: '/_me/credentials/:strategy', controller: 'auth', action: 'getMyCredentials'},
  {verb: 'get', url: '/_me/credentials/:strategy/_exists', controller: 'auth', action: 'credentialsExist'},
  {verb: 'get', url: '/strategies', controller: 'auth', action: 'getStrategies'},

  {verb: 'get', url: '/users/_me', controller: 'auth', action: 'getCurrentUser'}, // @deprecated
  {verb: 'get', url: '/users/_me/_rights', controller: 'auth', action: 'getMyRights'}, // @deprecated
  {verb: 'get', url: '/credentials/:strategy/_me', controller: 'auth', action: 'getMyCredentials'}, // @deprecated
  {verb: 'get', url: '/credentials/:strategy/_me/_exists', controller: 'auth', action: 'credentialsExist'}, // @deprecated

  // We need to expose a GET method for "login" action in order to make authentication protocol like Oauth2 or CAS work:
  {verb: 'get', url: '/_login/:strategy', controller: 'auth', action: 'login'},

  {verb: 'get', url: '/:index/:collection/_exists', controller: 'collection', action: 'exists'},
  {verb: 'get', url: '/:index/:collection/_mapping', controller: 'collection', action: 'getMapping'},
  {verb: 'get', url: '/:index/:collection/_search', controller: 'document', action: 'search'},
  {verb: 'get', url: '/:index/:collection/_specifications', controller: 'collection', action: 'getSpecifications'},
  {verb: 'get', url: '/validations/_scroll/:scrollId', controller: 'collection', action: 'scrollSpecifications'},
  {verb: 'get', url: '/:index/_list', controller: 'collection', action: 'list'},

  {verb: 'post', url: '/admin/_resetCache', controller: 'admin', action: 'resetCache'},
  {verb: 'post', url: '/admin/_resetSecurity', controller: 'admin', action: 'resetSecurity'},
  {verb: 'post', url: '/admin/_resetDatabase', controller: 'admin', action: 'resetDatabase'},
  {verb: 'post', url: '/admin/_resetKuzzleData', controller: 'admin', action: 'resetKuzzleData'},
  {verb: 'post', url: '/admin/_dump', controller: 'admin', action: 'dump'},
  {verb: 'post', url: '/admin/_shutdown/', controller: 'admin', action: 'shutdown'},
  {verb: 'post', url: '/admin/_loadFixtures', controller: 'admin', action: 'loadFixtures'},
  {verb: 'post', url: '/admin/_loadMappings', controller: 'admin', action: 'loadMappings'},
  {verb: 'post', url: '/admin/_loadSecurities', controller: 'admin', action: 'loadSecurities'},

  {verb: 'get', url: '/:index/:collection/:_id', controller: 'document', action: 'get'},
  {verb: 'get', url: '/:index/:collection/_mGet', controller: 'document', action: 'mGet'},
  {verb: 'get', url: '/:index/:collection/:_id/_exists', controller: 'document', action: 'exists'},
  {verb: 'get', url: '/_scroll/:scrollId', controller: 'document', action: 'scroll'},

  {verb: 'get', url: '/:index/_exists', controller: 'index', action: 'exists'},
  {verb: 'get', url: '/:index/_autoRefresh', controller: 'index', action: 'getAutoRefresh'},
  {verb: 'get', url: '/_list', controller: 'index', action: 'list'},

  {verb: 'get', url: '/_listSubscriptions', controller: 'realtime', action: 'list'},

  {verb: 'get', url: '/profiles/:_id', controller: 'security', action: 'getProfile'},
  {verb: 'get', url: '/profiles/:_id/_rights', controller: 'security', action: 'getProfileRights'},
  {verb: 'get', url: '/roles/:_id', controller: 'security', action: 'getRole'},
  {verb: 'get', url: '/users/:_id', controller: 'security', action: 'getUser'},
  {verb: 'get', url: '/users/_mGet', controller: 'security', action: 'mGetUsers'},
  {verb: 'get', url: '/users/:_id/_rights', controller: 'security', action: 'getUserRights'},
  {verb: 'get', url: '/profiles/_mapping', controller: 'security', action: 'getProfileMapping'},
  {verb: 'get', url: '/roles/_mapping', controller: 'security', action: 'getRoleMapping'},
  {verb: 'get', url: '/users/_mapping', controller: 'security', action: 'getUserMapping'},
  {verb: 'get', url: '/users/_scroll/:scrollId', controller: 'security', action: 'scrollUsers'},
  {verb: 'get', url: '/credentials/:strategy/:_id', controller: 'security', action: 'getCredentials'},
  {verb: 'get', url: '/credentials/:strategy/:_id/_byId', controller: 'security', action: 'getCredentialsById'},
  {verb: 'get', url: '/credentials/:strategy/:_id/_exists', controller: 'security', action: 'hasCredentials'},
  {verb: 'get', url: '/credentials/:strategy/_fields', controller: 'security', action: 'getCredentialFields'},
  {verb: 'get', url: '/credentials/_fields', controller: 'security', action: 'getAllCredentialFields'},
  {verb: 'get', url: '/profiles/_scroll/:scrollId', controller: 'security', action: 'scrollProfiles'},

  {verb: 'get', url: '/_adminExists', controller: 'server', action: 'adminExists'},
  {verb: 'get', url: '/_getAllStats', controller: 'server', action: 'getAllStats'},
  {verb: 'get', url: '/_getConfig', controller: 'server', action: 'getConfig'},
  {verb: 'get', url: '/_getLastStats', controller: 'server', action: 'getLastStats'},
  {verb: 'get', url: '/_getStats', controller: 'server', action: 'getStats'},
  {verb: 'get', url: '/', controller: 'server', action: 'info'},
  {verb: 'get', url: '/_healthCheck', controller: 'server', action: 'healthCheck'},
  {verb: 'get', url: '/_serverInfo', controller: 'server', action: 'info'},
  {verb: 'get', url: '/_now', controller: 'server', action: 'now'},
  {verb: 'get', url: '/_publicApi', controller: 'server', action: 'publicApi'},

  {verb: 'get', url: '/ms/_bitcount/:_id', controller: 'ms', action: 'bitcount'},
  {verb: 'get', url: '/ms/_bitpos/:_id', controller: 'ms', action: 'bitpos'},
  {verb: 'get', url: '/ms/_dbsize', controller: 'ms', action: 'dbsize'},
  {verb: 'get', url: '/ms/_getbit/:_id', controller: 'ms', action: 'getbit'},
  {verb: 'get', url: '/ms/_getrange/:_id', controller: 'ms', action: 'getrange'},
  {verb: 'get', url: '/ms/_exists', controller: 'ms', action: 'exists'},
  {verb: 'get', url: '/ms/_geodist/:_id/:member1/:member2', controller: 'ms', action: 'geodist'},
  {verb: 'get', url: '/ms/_geohash/:_id', controller: 'ms', action: 'geohash'},
  {verb: 'get', url: '/ms/_geopos/:_id', controller: 'ms', action: 'geopos'},
  {verb: 'get', url: '/ms/_georadius/:_id', controller: 'ms', action: 'georadius'},
  {verb: 'get', url: '/ms/_georadiusbymember/:_id', controller: 'ms', action: 'georadiusbymember'},
  {verb: 'get', url: '/ms/_hexists/:_id/:field', controller: 'ms', action: 'hexists'},
  {verb: 'get', url: '/ms/_hget/:_id/:field', controller: 'ms', action: 'hget'},
  {verb: 'get', url: '/ms/_hgetall/:_id', controller: 'ms', action: 'hgetall'},
  {verb: 'get', url: '/ms/_hkeys/:_id', controller: 'ms', action: 'hkeys'},
  {verb: 'get', url: '/ms/_hlen/:_id', controller: 'ms', action: 'hlen'},
  {verb: 'get', url: '/ms/_hmget/:_id', controller: 'ms', action: 'hmget'},
  {verb: 'get', url: '/ms/_hscan/:_id', controller: 'ms', action: 'hscan'},
  {verb: 'get', url: '/ms/_hstrlen/:_id/:field', controller: 'ms', action: 'hstrlen'},
  {verb: 'get', url: '/ms/_hvals/:_id', controller: 'ms', action: 'hvals'},
  {verb: 'get', url: '/ms/_keys/:pattern', controller: 'ms', action: 'keys'},
  {verb: 'get', url: '/ms/_lindex/:_id/:idx', controller: 'ms', action: 'lindex'},
  {verb: 'get', url: '/ms/_llen/:_id', controller: 'ms', action: 'llen'},
  {verb: 'get', url: '/ms/_lrange/:_id', controller: 'ms', action: 'lrange'},
  {verb: 'get', url: '/ms/_mget', controller: 'ms', action: 'mget'},
  {verb: 'get', url: '/ms/_object/:_id', controller: 'ms', action: 'object'},
  {verb: 'get', url: '/ms/_pfcount', controller: 'ms', action: 'pfcount'},
  {verb: 'get', url: '/ms/_ping', controller: 'ms', action: 'ping'},
  {verb: 'get', url: '/ms/_pttl/:_id', controller: 'ms', action: 'pttl'},
  {verb: 'get', url: '/ms/_randomkey', controller: 'ms', action: 'randomkey'},
  {verb: 'get', url: '/ms/_scan', controller: 'ms', action: 'scan'},
  {verb: 'get', url: '/ms/_scard/:_id', controller: 'ms', action: 'scard'},
  {verb: 'get', url: '/ms/_sdiff/:_id', controller: 'ms', action: 'sdiff'},
  {verb: 'get', url: '/ms/_sinter', controller: 'ms', action: 'sinter'},
  {verb: 'get', url: '/ms/_sismember/:_id/:member', controller: 'ms', action: 'sismember'},
  {verb: 'get', url: '/ms/_smembers/:_id', controller: 'ms', action: 'smembers'},
  {verb: 'get', url: '/ms/_srandmember/:_id', controller: 'ms', action: 'srandmember'},
  {verb: 'get', url: '/ms/_sscan/:_id', controller: 'ms', action: 'sscan'},
  {verb: 'get', url: '/ms/_strlen/:_id', controller: 'ms', action: 'strlen'},
  {verb: 'get', url: '/ms/_sunion', controller: 'ms', action: 'sunion'},
  {verb: 'get', url: '/ms/_time', controller: 'ms', action: 'time'},
  {verb: 'get', url: '/ms/_ttl/:_id', controller: 'ms', action: 'ttl'},
  {verb: 'get', url: '/ms/_type/:_id', controller: 'ms', action: 'type'},
  {verb: 'get', url: '/ms/_zcard/:_id', controller: 'ms', action: 'zcard'},
  {verb: 'get', url: '/ms/_zcount/:_id', controller: 'ms', action: 'zcount'},
  {verb: 'get', url: '/ms/_zlexcount/:_id', controller: 'ms', action: 'zlexcount'},
  {verb: 'get', url: '/ms/_zrange/:_id', controller: 'ms', action: 'zrange'},
  {verb: 'get', url: '/ms/_zrangebylex/:_id', controller: 'ms', action: 'zrangebylex'},
  {verb: 'get', url: '/ms/_zrevrangebylex/:_id', controller: 'ms', action: 'zrevrangebylex'},
  {verb: 'get', url: '/ms/_zrangebyscore/:_id', controller: 'ms', action: 'zrangebyscore'},
  {verb: 'get', url: '/ms/_zrank/:_id/:member', controller: 'ms', action: 'zrank'},
  {verb: 'get', url: '/ms/_zrevrange/:_id', controller: 'ms', action: 'zrevrange'},
  {verb: 'get', url: '/ms/_zrevrangebyscore/:_id', controller: 'ms', action: 'zrevrangebyscore'},
  {verb: 'get', url: '/ms/_zrevrank/:_id/:member', controller: 'ms', action: 'zrevrank'},
  {verb: 'get', url: '/ms/_zscan/:_id', controller: 'ms', action: 'zscan'},
  {verb: 'get', url: '/ms/_zscore/:_id/:member', controller: 'ms', action: 'zscore'},
  {verb: 'get', url: '/ms/:_id', controller: 'ms', action: 'get'},


  // POST
  {verb: 'post', url: '/_login/:strategy', controller: 'auth', action: 'login'},
  {verb: 'post', url: '/_logout', controller: 'auth', action: 'logout'},
  {verb: 'post', url: '/_checkToken', controller: 'auth', action: 'checkToken'},
  {verb: 'post', url: '/_refreshToken', controller: 'auth', action: 'refreshToken'},
  {verb: 'post', url: '/_me/credentials/:strategy/_create', controller: 'auth', action: 'createMyCredentials'},
  {verb: 'post', url: '/_me/credentials/:strategy/_validate', controller: 'auth', action: 'validateMyCredentials'},

  {verb: 'post', url: '/credentials/:strategy/_me/_create', controller: 'auth', action: 'createMyCredentials'}, // @deprecated
  {verb: 'post', url: '/credentials/:strategy/_me/_validate', controller: 'auth', action: 'validateMyCredentials'}, // @deprecated

  {verb: 'post', url: '/:index/:collection/_validateSpecifications', controller: 'collection', action: 'validateSpecifications'},
  {verb: 'post', url: '/validations/_search', controller: 'collection', action: 'searchSpecifications'},

  {verb: 'post', url: '/:index/:collection/_bulk', controller: 'bulk', action: 'import'},

  {verb: 'post', url: '/:index/:collection/_mWrite', controller: 'bulk', action: 'mWrite'},
  {verb: 'post', url: '/:index/:collection/_write', controller: 'bulk', action: 'write'},

  {verb: 'post', url: '/:index/:collection/_refresh', controller: 'collection', action: 'refresh' },
  {verb: 'post', url: '/_security/:collection/_refresh', controller: 'security', action: 'refresh' },

  {verb: 'post', url: '/:index/_create', controller: 'index', action: 'create'},

  {verb: 'post', url: '/:index/:collection/_count', controller: 'document', action: 'count'},
  {verb: 'post', url: '/:index/:collection/_create', controller: 'document', action: 'create'},
  {verb: 'post', url: '/:index/:collection/:_id/_create', controller: 'document', action: 'create'},
  {verb: 'post', url: '/:index/:collection/_publish', controller: 'realtime', action: 'publish'},
  {verb: 'post', url: '/:index/:collection/_search', controller: 'document', action: 'search'},
  {verb: 'post', url: '/:index/:collection/_mGet', controller: 'document', action: 'mGet'},
  {verb: 'post', url: '/:index/:collection/_mCreate', controller: 'document', action: 'mCreate'},
  {verb: 'post', url: '/:index/:collection/_validate', controller: 'document', action: 'validate'},

  {verb: 'post', url: '/_createFirstAdmin/:_id', controller: 'security', action: 'createFirstAdmin'},
  {verb: 'post', url: '/_createFirstAdmin', controller: 'security', action: 'createFirstAdmin'},

  {verb: 'post', url: '/credentials/:strategy/:_id/_create', controller: 'security', action: 'createCredentials'},
  {verb: 'post', url: '/profiles/:_id/_create', controller: 'security', action: 'createProfile'},
  {verb: 'post', url: '/roles/:_id/_create', controller: 'security', action: 'createRole'},
  {verb: 'post', url: '/users/_createRestricted', controller: 'security', action: 'createRestrictedUser'},
  {verb: 'post', url: '/users/:_id/_createRestricted', controller: 'security', action: 'createRestrictedUser'},
  {verb: 'post', url: '/users/_create', controller: 'security', action: 'createUser'},
  {verb: 'post', url: '/users/:_id/_create', controller: 'security', action: 'createUser'},
  {verb: 'post', url: '/profiles/_mDelete', controller: 'security', action: 'mDeleteProfiles'},
  {verb: 'post', url: '/roles/_mDelete', controller: 'security', action: 'mDeleteRoles'},
  {verb: 'post', url: '/users/_mDelete', controller: 'security', action: 'mDeleteUsers'},
  {verb: 'post', url: '/profiles/_mGet', controller: 'security', action: 'mGetProfiles'},
  {verb: 'post', url: '/users/_mGet', controller: 'security', action: 'mGetUsers'},
  {verb: 'post', url: '/roles/_mGet', controller: 'security', action: 'mGetRoles'},
  {verb: 'post', url: '/profiles/_search', controller: 'security', action: 'searchProfiles'},
  {verb: 'post', url: '/roles/_search', controller: 'security', action: 'searchRoles'},
  {verb: 'post', url: '/users/_search', controller: 'security', action: 'searchUsers'},
  {verb: 'post', url: '/credentials/:strategy/:_id/_validate', controller: 'security', action: 'validateCredentials'},

  {verb: 'post', url: '/users/:userId/api-keys/_create', controller: 'security', action: 'createApiKey'},
  {verb: 'post', url: '/users/:userId/api-keys/_search', controller: 'security', action: 'searchApiKeys'},

  {verb: 'post', url: '/api-keys/_create', controller: 'auth', action: 'createApiKey'},
  {verb: 'post', url: '/api-keys/_search', controller: 'auth', action: 'searchApiKeys'},

  {verb: 'post', url: '/ms/_append/:_id', controller: 'ms', action: 'append'},
  {verb: 'post', url: '/ms/_bgrewriteaof', controller: 'ms', action: 'bgrewriteaof'},
  {verb: 'post', url: '/ms/_bgsave', controller: 'ms', action: 'bgsave'},
  {verb: 'post', url: '/ms/_bitop/:_id', controller: 'ms', action: 'bitop'},
  {verb: 'post', url: '/ms/_decr/:_id', controller: 'ms', action: 'decr'},
  {verb: 'post', url: '/ms/_decrby/:_id', controller: 'ms', action: 'decrby'},
  {verb: 'post', url: '/ms/_expire/:_id', controller: 'ms', action: 'expire'},
  {verb: 'post', url: '/ms/_expireat/:_id', controller: 'ms', action: 'expireat'},
  {verb: 'post', url: '/ms/_flushdb', controller: 'ms', action: 'flushdb'},
  {verb: 'post', url: '/ms/_geoadd/:_id', controller: 'ms', action: 'geoadd'},
  {verb: 'post', url: '/ms/_getset/:_id', controller: 'ms', action: 'getset'},
  {verb: 'post', url: '/ms/_hincrby/:_id', controller: 'ms', action: 'hincrby'},
  {verb: 'post', url: '/ms/_hincrbyfloat/:_id', controller: 'ms', action: 'hincrbyfloat'},
  {verb: 'post', url: '/ms/_hmset/:_id', controller: 'ms', action: 'hmset'},
  {verb: 'post', url: '/ms/_hset/:_id', controller: 'ms', action: 'hset'},
  {verb: 'post', url: '/ms/_hsetnx/:_id', controller: 'ms', action: 'hsetnx'},
  {verb: 'post', url: '/ms/_incr/:_id', controller: 'ms', action: 'incr'},
  {verb: 'post', url: '/ms/_incrby/:_id', controller: 'ms', action: 'incrby'},
  {verb: 'post', url: '/ms/_incrbyfloat/:_id', controller: 'ms', action: 'incrbyfloat'},
  {verb: 'post', url: '/ms/_linsert/:_id', controller: 'ms', action: 'linsert'},
  {verb: 'post', url: '/ms/_lpop/:_id', controller: 'ms', action: 'lpop'},
  {verb: 'post', url: '/ms/_lpush/:_id', controller: 'ms', action: 'lpush'},
  {verb: 'post', url: '/ms/_lpushx/:_id', controller: 'ms', action: 'lpushx'},
  {verb: 'post', url: '/ms/_lset/:_id', controller: 'ms', action: 'lset'},
  {verb: 'post', url: '/ms/_ltrim/:_id', controller: 'ms', action: 'ltrim'},
  {verb: 'post', url: '/ms/_mexecute', controller: 'ms', action: 'mexecute'},
  {verb: 'post', url: '/ms/_mset', controller: 'ms', action: 'mset'},
  {verb: 'post', url: '/ms/_msetnx', controller: 'ms', action: 'msetnx'},
  {verb: 'post', url: '/ms/_persist/:_id', controller: 'ms', action: 'persist'},
  {verb: 'post', url: '/ms/_pexpire/:_id', controller: 'ms', action: 'pexpire'},
  {verb: 'post', url: '/ms/_pexpireat/:_id', controller: 'ms', action: 'pexpireat'},
  {verb: 'post', url: '/ms/_pfadd/:_id', controller: 'ms', action: 'pfadd'},
  {verb: 'post', url: '/ms/_pfmerge/:_id', controller: 'ms', action: 'pfmerge'},
  {verb: 'post', url: '/ms/_psetex/:_id', controller: 'ms', action: 'psetex'},
  {verb: 'post', url: '/ms/_rename/:_id', controller: 'ms', action: 'rename'},
  {verb: 'post', url: '/ms/_renamenx/:_id', controller: 'ms', action: 'renamenx'},
  {verb: 'post', url: '/ms/_rpop/:_id', controller: 'ms', action: 'rpop'},
  {verb: 'post', url: '/ms/_rpoplpush', controller: 'ms', action: 'rpoplpush'},
  {verb: 'post', url: '/ms/_rpush/:_id', controller: 'ms', action: 'rpush'},
  {verb: 'post', url: '/ms/_rpushx/:_id', controller: 'ms', action: 'rpushx'},
  {verb: 'post', url: '/ms/_sadd/:_id', controller: 'ms', action: 'sadd'},
  {verb: 'post', url: '/ms/_sdiffstore/:_id', controller: 'ms', action: 'sdiffstore'},
  {verb: 'post', url: '/ms/_set/:_id', controller: 'ms', action: 'set'},
  {verb: 'post', url: '/ms/_setex/:_id', controller: 'ms', action: 'setex'},
  {verb: 'post', url: '/ms/_setnx/:_id', controller: 'ms', action: 'setnx'},
  {verb: 'post', url: '/ms/_sinterstore', controller: 'ms', action: 'sinterstore'},
  {verb: 'post', url: '/ms/_smove/:_id', controller: 'ms', action: 'smove'},
  {verb: 'post', url: '/ms/_sort/:_id', controller: 'ms', action: 'sort'},
  {verb: 'post', url: '/ms/_spop/:_id', controller: 'ms', action: 'spop'},
  {verb: 'post', url: '/ms/_sunionstore', controller: 'ms', action: 'sunionstore'},
  {verb: 'post', url: '/ms/_touch', controller: 'ms', action: 'touch'},
  {verb: 'post', url: '/ms/_zadd/:_id', controller: 'ms', action: 'zadd'},
  {verb: 'post', url: '/ms/_zincrby/:_id', controller: 'ms', action: 'zincrby'},
  {verb: 'post', url: '/ms/_zinterstore/:_id', controller: 'ms', action: 'zinterstore'},
  {verb: 'post', url: '/ms/_zunionstore/:_id', controller: 'ms', action: 'zunionstore'},


  // DELETE
  {verb: 'delete', url: '/_me/credentials/:strategy', controller: 'auth', action: 'deleteMyCredentials'},

  {verb: 'delete', url: '/credentials/:strategy/_me', controller: 'auth', action: 'deleteMyCredentials'}, // @deprecated

  {verb: 'delete', url: '/:index/:collection/_specifications', controller: 'collection', action: 'deleteSpecifications'},
  {verb: 'delete', url: '/:index/:collection/_truncate', controller: 'collection', action: 'truncate'},

  {verb: 'delete', url: '/:index/:collection/:_id', controller: 'document', action: 'delete'},
  {verb: 'delete', url: '/:index/:collection/_query', controller: 'document', action: 'deleteByQuery'},
  {verb: 'delete', url: '/:index/:collection/_bulk/_query', controller: 'bulk', action: 'deleteByQuery'},

  {verb: 'delete', url: '/:index/:collection/_mDelete', controller: 'document', action: 'mDelete'},

  {verb: 'delete', url: '/:index', controller: 'index', action: 'delete'},
  {verb: 'delete', url: '/_mdelete', controller: 'index', action: 'mDelete'},

  {verb: 'delete', url: '/:index/:collection', controller: 'collection', action: 'delete'},

  {verb: 'delete', url: '/profiles/:_id', controller: 'security', action: 'deleteProfile'},
  {verb: 'delete', url: '/roles/:_id', controller: 'security', action: 'deleteRole'},
  {verb: 'delete', url: '/users/:_id', controller: 'security', action: 'deleteUser'},
  {verb: 'delete', url: '/credentials/:strategy/:_id', controller: 'security', action: 'deleteCredentials'},
  {verb: 'delete', url: '/users/:_id/tokens', controller: 'security', action: 'revokeTokens'},

  {verb: 'delete', url: '/ms', controller: 'ms', action: 'del'},
  {verb: 'delete', url: '/ms/_hdel/:_id', controller: 'ms', action: 'hdel'},
  {verb: 'delete', url: '/ms/_lrem/:_id', controller: 'ms', action: 'lrem'},
  {verb: 'delete', url: '/ms/_srem/:_id', controller: 'ms', action: 'srem'},
  {verb: 'delete', url: '/ms/_zrem/:_id', controller: 'ms', action: 'zrem'},
  {verb: 'delete', url: '/ms/_zremrangebylex/:_id', controller: 'ms', action: 'zremrangebylex'},
  {verb: 'delete', url: '/ms/_zremrangebyrank/:_id', controller: 'ms', action: 'zremrangebyrank'},
  {verb: 'delete', url: '/ms/_zremrangebyscore/:_id', controller: 'ms', action: 'zremrangebyscore'},

  {verb: 'delete', url: '/users/:userId/api-keys/:_id', controller: 'security', action: 'deleteApiKey'},
  {verb: 'delete', url: '/api-keys/:_id', controller: 'auth', action: 'deleteApiKey'},


  // PUT (idempotent)
  {verb: 'put', url: '/_me', controller: 'auth', action: 'updateSelf'},
  {verb: 'put', url: '/_me/credentials/:strategy/_update', controller: 'auth', action: 'updateMyCredentials'},

  {verb: 'put', url: '/_updateSelf', controller: 'auth', action: 'updateSelf'}, // @deprecated
  {verb: 'put', url: '/credentials/:strategy/_me/_update', controller: 'auth', action: 'updateMyCredentials'}, // @deprecated

  {verb: 'put', url: '/:index/:collection', controller: 'collection', action: 'create'},
  {verb: 'post', url: '/:index/:collection', controller: 'collection', action: 'update'},
  {verb: 'put', url: '/:index/:collection/_mapping', controller: 'collection', action: 'updateMapping'},

  {verb: 'put', url: '/:index/:collection/_specifications', controller: 'collection', action: 'updateSpecifications'},

  {verb: 'put', url: '/:index/:collection/:_id', controller: 'document', action: 'createOrReplace'},
  {verb: 'put', url: '/:index/:collection/_mCreateOrReplace', controller: 'document', action: 'mCreateOrReplace'},
  {verb: 'put', url: '/:index/:collection/:_id/_replace', controller: 'document', action: 'replace'},
  {verb: 'put', url: '/:index/:collection/_mReplace', controller: 'document', action: 'mReplace'},
  {verb: 'put', url: '/:index/:collection/_mUpdate', controller: 'document', action: 'mUpdate'},
  {verb: 'put', url: '/:index/:collection/:_id/_update', controller: 'document', action: 'update'},
  {verb: 'put', url: '/:index/:collection/_query', controller: 'document', action: 'updateByQuery'},

  {verb: 'put', url: '/profiles/:_id', controller: 'security', action: 'createOrReplaceProfile'},
  {verb: 'put', url: '/roles/:_id', controller: 'security', action: 'createOrReplaceRole'},
  {verb: 'put', url: '/credentials/:strategy/:_id/_update', controller: 'security', action: 'updateCredentials'},
  {verb: 'put', url: '/profiles/:_id/_update', controller: 'security', action: 'updateProfile'},
  {verb: 'put', url: '/roles/:_id/_update', controller: 'security', action: 'updateRole'},
  {verb: 'put', url: '/users/:_id/_update', controller: 'security', action: 'updateUser'},
  {verb: 'put', url: '/users/:_id/_replace', controller: 'security', action: 'replaceUser'},
  {verb: 'put', url: '/profiles/_mapping', controller: 'security', action: 'updateProfileMapping'},
  {verb: 'put', url: '/roles/_mapping', controller: 'security', action: 'updateRoleMapping'},
  {verb: 'put', url: '/users/_mapping', controller: 'security', action: 'updateUserMapping'}
];
