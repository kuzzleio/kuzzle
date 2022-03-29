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

const {
  OpenApiDocumentCount,
  OpenApiDocumentDeleteByQuery,
  OpenApiDocumentDelete,
  OpenApiDocumentScroll,
  OpenApiDocumentExists,
  OpenApiDocumentUpdate,
  OpenApiDocumentReplace,
  OpenApiDocumentGet,
  OpenApiDocumentCreate,
  OpenApiDocumentCreateOrReplace,
  OpenApiDocumentValidate,
} = require('./openapi/components/document');


const routes = [
  // GET (idempotent)
  { verb: 'get', path: '/_me', controller: 'auth', action: 'getCurrentUser' },
  { verb: 'get', path: '/_me/_rights', controller: 'auth', action: 'getMyRights' },
  { verb: 'get', path: '/_me/credentials/:strategy', controller: 'auth', action: 'getMyCredentials' },
  { verb: 'get', path: '/_me/credentials/:strategy/_exists', controller: 'auth', action: 'credentialsExist' },
  { verb: 'get', path: '/strategies', controller: 'auth', action: 'getStrategies' },

  { verb: 'get', path: '/users/_me', controller: 'auth', action: 'getCurrentUser', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me' } }, // @deprecated
  { verb: 'get', path: '/users/_me/_rights', controller: 'auth', action: 'getMyRights', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me/_rights' } }, // @deprecated
  { verb: 'get', path: '/credentials/:strategy/_me', controller: 'auth', action: 'getMyCredentials', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me/credentials/:strategy' } }, // @deprecated
  { verb: 'get', path: '/credentials/:strategy/_me/_exists', controller: 'auth', action: 'credentialsExist', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_exists' } }, // @deprecated

  // We need to expose a GET method for "login" action in order to make authentication protocol like Oauth2 or CAS work:
  { verb: 'get', path: '/_login/:strategy', controller: 'auth', action: 'login' },

  { verb: 'get', path: '/:index/:collection/_export', controller: 'document', action: 'export' },
  { verb: 'get', path: '/:index/:collection/_exists', controller: 'collection', action: 'exists' },
  { verb: 'get', path: '/:index/:collection/_mapping', controller: 'collection', action: 'getMapping' },
  { verb: 'get', path: '/:index/:collection/_search', controller: 'document', action: 'search' },
  { verb: 'get', path: '/:index/:collection/_specifications', controller: 'collection', action: 'getSpecifications' },
  { verb: 'get', path: '/validations/_scroll/:scrollId', controller: 'collection', action: 'scrollSpecifications' },
  { verb: 'get', path: '/:index/_list', controller: 'collection', action: 'list' },

  { verb: 'post', path: '/admin/_refreshIndexCache', controller: 'admin', action: 'refreshIndexCache' },
  { verb: 'post', path: '/admin/_resetCache', controller: 'admin', action: 'resetCache' },
  { verb: 'post', path: '/admin/_resetSecurity', controller: 'admin', action: 'resetSecurity' },
  { verb: 'post', path: '/admin/_resetDatabase', controller: 'admin', action: 'resetDatabase' },
  { verb: 'post', path: '/admin/_resetKuzzleData', controller: 'admin', action: 'resetKuzzleData' },
  { verb: 'post', path: '/admin/_dump', controller: 'admin', action: 'dump' },
  { verb: 'post', path: '/admin/_shutdown/', controller: 'admin', action: 'shutdown' },
  { verb: 'post', path: '/admin/_loadFixtures', controller: 'admin', action: 'loadFixtures' },
  { verb: 'post', path: '/admin/_loadMappings', controller: 'admin', action: 'loadMappings' },
  { verb: 'post', path: '/admin/_loadSecurities', controller: 'admin', action: 'loadSecurities' },

  { verb: 'get', path: '/:index/:collection/:_id', controller: 'document', action: 'get', openapi: OpenApiDocumentGet },
  { verb: 'get', path: '/:index/:collection/_mGet', controller: 'document', action: 'mGet' },
  { verb: 'get', path: '/:index/:collection/:_id/_exists', controller: 'document', action: 'exists', openapi: OpenApiDocumentExists },
  { verb: 'get', path: '/:index/:collection/_mExists', controller: 'document', action: 'mExists' },
  { verb: 'get', path: '/_scroll/:scrollId', controller: 'document', action: 'scroll', openapi: OpenApiDocumentScroll },

  { verb: 'get', path: '/:index/_exists', controller: 'index', action: 'exists' },
  { verb: 'get', path: '/:index/_autoRefresh', controller: 'index', action: 'getAutoRefresh' },
  { verb: 'get', path: '/_list', controller: 'index', action: 'list' },
  { verb: 'get', path: '/_storageStats', controller: 'index', action: 'stats' },

  { verb: 'get', path: '/_listSubscriptions', controller: 'realtime', action: 'list' },

  { verb: 'get', path: '/profiles/:_id', controller: 'security', action: 'getProfile' },
  { verb: 'get', path: '/profiles/:_id/_rights', controller: 'security', action: 'getProfileRights' },
  { verb: 'get', path: '/roles/:_id', controller: 'security', action: 'getRole' },
  { verb: 'get', path: '/users/:_id', controller: 'security', action: 'getUser' },
  { verb: 'get', path: '/users/:_id/_strategies', controller: 'security', action: 'getUserStrategies' },
  { verb: 'get', path: '/users/_mGet', controller: 'security', action: 'mGetUsers' },
  { verb: 'get', path: '/users/:_id/_rights', controller: 'security', action: 'getUserRights' },
  { verb: 'get', path: '/profiles/_mapping', controller: 'security', action: 'getProfileMapping' },
  { verb: 'get', path: '/roles/_mapping', controller: 'security', action: 'getRoleMapping' },
  { verb: 'get', path: '/users/_mapping', controller: 'security', action: 'getUserMapping' },
  { verb: 'get', path: '/users/_scroll/:scrollId', controller: 'security', action: 'scrollUsers' },
  { verb: 'get', path: '/credentials/:strategy/:_id', controller: 'security', action: 'getCredentials' },
  { verb: 'get', path: '/credentials/:strategy/:_id/_byId', controller: 'security', action: 'getCredentialsById' },
  { verb: 'get', path: '/credentials/:strategy/:_id/_exists', controller: 'security', action: 'hasCredentials' },
  { verb: 'get', path: '/credentials/:strategy/_fields', controller: 'security', action: 'getCredentialFields' },
  { verb: 'get', path: '/credentials/_fields', controller: 'security', action: 'getAllCredentialFields' },
  { verb: 'get', path: '/profiles/_scroll/:scrollId', controller: 'security', action: 'scrollProfiles' },

  { verb: 'get', path: '/_adminExists', controller: 'server', action: 'adminExists' },
  { verb: 'get', path: '/_getAllStats', controller: 'server', action: 'getAllStats', deprecated: { since: 'auto-version', message: 'Use this route instead: http://kuzzle:7512/_metrics' } }, // @deprecated
  { verb: 'get', path: '/_getConfig', controller: 'server', action: 'getConfig' },
  { verb: 'get', path: '/_capabilities', controller: 'server', action: 'capabilities' },
  { verb: 'get', path: '/_getLastStats', controller: 'server', action: 'getLastStats', deprecated: { since: 'auto-version', message: 'Use this route instead: http://kuzzle:7512/_metrics' } }, // @deprecated
  { verb: 'get', path: '/_getStats', controller: 'server', action: 'getStats', deprecated: { since: 'auto-version', message: 'Use this route instead: http://kuzzle:7512/_metrics' } }, // @deprecated
  { verb: 'get', path: '/', controller: 'server', action: 'info' },
  { verb: 'get', path: '/_healthCheck', controller: 'server', action: 'healthCheck' },
  { verb: 'get', path: '/_serverInfo', controller: 'server', action: 'info' },
  { verb: 'get', path: '/_now', controller: 'server', action: 'now' },
  { verb: 'get', path: '/_publicApi', controller: 'server', action: 'publicApi', deprecated: { since: '2.5.0', message: 'Use this route instead: http://kuzzle:7512/_openapi' } }, // @deprecated
  { verb: 'get', path: '/_openapi', controller: 'server', action: 'openapi' },
  { verb: 'get', path: '/_metrics', controller: 'server', action: 'metrics' },

  { verb: 'get', path: '/ms/_bitcount/:_id', controller: 'ms', action: 'bitcount' },
  { verb: 'get', path: '/ms/_bitpos/:_id', controller: 'ms', action: 'bitpos' },
  { verb: 'get', path: '/ms/_dbsize', controller: 'ms', action: 'dbsize' },
  { verb: 'get', path: '/ms/_getbit/:_id', controller: 'ms', action: 'getbit' },
  { verb: 'get', path: '/ms/_getrange/:_id', controller: 'ms', action: 'getrange' },
  { verb: 'get', path: '/ms/_exists', controller: 'ms', action: 'exists' },
  { verb: 'get', path: '/ms/_geodist/:_id/:member1/:member2', controller: 'ms', action: 'geodist' },
  { verb: 'get', path: '/ms/_geohash/:_id', controller: 'ms', action: 'geohash' },
  { verb: 'get', path: '/ms/_geopos/:_id', controller: 'ms', action: 'geopos' },
  { verb: 'get', path: '/ms/_georadius/:_id', controller: 'ms', action: 'georadius' },
  { verb: 'get', path: '/ms/_georadiusbymember/:_id', controller: 'ms', action: 'georadiusbymember' },
  { verb: 'get', path: '/ms/_hexists/:_id/:field', controller: 'ms', action: 'hexists' },
  { verb: 'get', path: '/ms/_hget/:_id/:field', controller: 'ms', action: 'hget' },
  { verb: 'get', path: '/ms/_hgetall/:_id', controller: 'ms', action: 'hgetall' },
  { verb: 'get', path: '/ms/_hkeys/:_id', controller: 'ms', action: 'hkeys' },
  { verb: 'get', path: '/ms/_hlen/:_id', controller: 'ms', action: 'hlen' },
  { verb: 'get', path: '/ms/_hmget/:_id', controller: 'ms', action: 'hmget' },
  { verb: 'get', path: '/ms/_hscan/:_id', controller: 'ms', action: 'hscan' },
  { verb: 'get', path: '/ms/_hstrlen/:_id/:field', controller: 'ms', action: 'hstrlen' },
  { verb: 'get', path: '/ms/_hvals/:_id', controller: 'ms', action: 'hvals' },
  { verb: 'get', path: '/ms/_keys/:pattern', controller: 'ms', action: 'keys' },
  { verb: 'get', path: '/ms/_lindex/:_id/:idx', controller: 'ms', action: 'lindex' },
  { verb: 'get', path: '/ms/_llen/:_id', controller: 'ms', action: 'llen' },
  { verb: 'get', path: '/ms/_lrange/:_id', controller: 'ms', action: 'lrange' },
  { verb: 'get', path: '/ms/_mget', controller: 'ms', action: 'mget' },
  { verb: 'get', path: '/ms/_object/:_id', controller: 'ms', action: 'object' },
  { verb: 'get', path: '/ms/_pfcount', controller: 'ms', action: 'pfcount' },
  { verb: 'get', path: '/ms/_ping', controller: 'ms', action: 'ping' },
  { verb: 'get', path: '/ms/_pttl/:_id', controller: 'ms', action: 'pttl' },
  { verb: 'get', path: '/ms/_randomkey', controller: 'ms', action: 'randomkey' },
  { verb: 'get', path: '/ms/_scan', controller: 'ms', action: 'scan' },
  { verb: 'get', path: '/ms/_scard/:_id', controller: 'ms', action: 'scard' },
  { verb: 'get', path: '/ms/_sdiff/:_id', controller: 'ms', action: 'sdiff' },
  { verb: 'get', path: '/ms/_sinter', controller: 'ms', action: 'sinter' },
  { verb: 'get', path: '/ms/_sismember/:_id/:member', controller: 'ms', action: 'sismember' },
  { verb: 'get', path: '/ms/_smembers/:_id', controller: 'ms', action: 'smembers' },
  { verb: 'get', path: '/ms/_srandmember/:_id', controller: 'ms', action: 'srandmember' },
  { verb: 'get', path: '/ms/_sscan/:_id', controller: 'ms', action: 'sscan' },
  { verb: 'get', path: '/ms/_strlen/:_id', controller: 'ms', action: 'strlen' },
  { verb: 'get', path: '/ms/_sunion', controller: 'ms', action: 'sunion' },
  { verb: 'get', path: '/ms/_time', controller: 'ms', action: 'time' },
  { verb: 'get', path: '/ms/_ttl/:_id', controller: 'ms', action: 'ttl' },
  { verb: 'get', path: '/ms/_type/:_id', controller: 'ms', action: 'type' },
  { verb: 'get', path: '/ms/_zcard/:_id', controller: 'ms', action: 'zcard' },
  { verb: 'get', path: '/ms/_zcount/:_id', controller: 'ms', action: 'zcount' },
  { verb: 'get', path: '/ms/_zlexcount/:_id', controller: 'ms', action: 'zlexcount' },
  { verb: 'get', path: '/ms/_zrange/:_id', controller: 'ms', action: 'zrange' },
  { verb: 'get', path: '/ms/_zrangebylex/:_id', controller: 'ms', action: 'zrangebylex' },
  { verb: 'get', path: '/ms/_zrevrangebylex/:_id', controller: 'ms', action: 'zrevrangebylex' },
  { verb: 'get', path: '/ms/_zrangebyscore/:_id', controller: 'ms', action: 'zrangebyscore' },
  { verb: 'get', path: '/ms/_zrank/:_id/:member', controller: 'ms', action: 'zrank' },
  { verb: 'get', path: '/ms/_zrevrange/:_id', controller: 'ms', action: 'zrevrange' },
  { verb: 'get', path: '/ms/_zrevrangebyscore/:_id', controller: 'ms', action: 'zrevrangebyscore' },
  { verb: 'get', path: '/ms/_zrevrank/:_id/:member', controller: 'ms', action: 'zrevrank' },
  { verb: 'get', path: '/ms/_zscan/:_id', controller: 'ms', action: 'zscan' },
  { verb: 'get', path: '/ms/_zscore/:_id/:member', controller: 'ms', action: 'zscore' },
  { verb: 'get', path: '/ms/:_id', controller: 'ms', action: 'get' },
  { verb: 'get', path: '/cluster/_status', controller: 'cluster', action: 'status' },


  // POST
  { verb: 'post', path: '/_login/:strategy', controller: 'auth', action: 'login' },
  { verb: 'post', path: '/_logout', controller: 'auth', action: 'logout' },
  { verb: 'post', path: '/_checkToken', controller: 'auth', action: 'checkToken' },
  { verb: 'post', path: '/_refreshToken', controller: 'auth', action: 'refreshToken' },
  { verb: 'post', path: '/_me/credentials/:strategy/_create', controller: 'auth', action: 'createMyCredentials' },
  { verb: 'post', path: '/_me/credentials/:strategy/_validate', controller: 'auth', action: 'validateMyCredentials' },

  { verb: 'post', path: '/credentials/:strategy/_me/_create', controller: 'auth', action: 'createMyCredentials', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_create' } }, // @deprecated
  { verb: 'post', path: '/credentials/:strategy/_me/_validate', controller: 'auth', action: 'validateMyCredentials', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_validate' } }, // @deprecated

  { verb: 'post', path: '/:index/:collection/_validateSpecifications', controller: 'collection', action: 'validateSpecifications' },
  { verb: 'post', path: '/validations/_search', controller: 'collection', action: 'searchSpecifications' },

  { verb: 'post', path: '/:index/:collection/_bulk', controller: 'bulk', action: 'import' },

  { verb: 'post', path: '/:index/:collection/_mWrite', controller: 'bulk', action: 'mWrite' },
  { verb: 'post', path: '/:index/:collection/_write', controller: 'bulk', action: 'write' },

  { verb: 'post', path: '/:index/:collection/_refresh', controller: 'collection', action: 'refresh' },
  { verb: 'post', path: '/_security/:collection/_refresh', controller: 'security', action: 'refresh' },

  { verb: 'post', path: '/:index/_create', controller: 'index', action: 'create' },

  { verb: 'post', path: '/:index/:collection/_count', controller: 'document', action: 'count', openapi: OpenApiDocumentCount },
  { verb: 'post', path: '/:index/:collection/_create', controller: 'document', action: 'create', openapi: OpenApiDocumentCreate },
  { verb: 'post', path: '/:index/:collection/:_id/_create', controller: 'document', action: 'create' },
  { verb: 'post', path: '/:index/:collection/_publish', controller: 'realtime', action: 'publish' },
  { verb: 'post', path: '/:index/:collection/_export', controller: 'document', action: 'export' },
  { verb: 'post', path: '/:index/:collection/_search', controller: 'document', action: 'search' },
  { verb: 'post', path: '/:index/:collection/_mGet', controller: 'document', action: 'mGet' },
  { verb: 'post', path: '/:index/:collection/_mCreate', controller: 'document', action: 'mCreate' },
  { verb: 'post', path: '/:index/:collection/_mUpsert', controller: 'document', action: 'mUpsert' },
  { verb: 'post', path: '/:index/:collection/:_id/_upsert', controller: 'document', action: 'upsert' },
  { verb: 'post', path: '/:index/:collection/_validate', controller: 'document', action: 'validate', openapi: OpenApiDocumentValidate },

  { verb: 'post', path: '/_createFirstAdmin/:_id', controller: 'security', action: 'createFirstAdmin' },
  { verb: 'post', path: '/_createFirstAdmin', controller: 'security', action: 'createFirstAdmin' },

  { verb: 'post', path: '/credentials/:strategy/:_id/_create', controller: 'security', action: 'createCredentials' },
  { verb: 'post', path: '/profiles/:_id/_create', controller: 'security', action: 'createProfile' },
  { verb: 'post', path: '/roles/:_id/_create', controller: 'security', action: 'createRole' },
  { verb: 'post', path: '/users/_createRestricted', controller: 'security', action: 'createRestrictedUser' },
  { verb: 'post', path: '/users/:_id/_createRestricted', controller: 'security', action: 'createRestrictedUser' },
  { verb: 'post', path: '/users/_create', controller: 'security', action: 'createUser' },
  { verb: 'post', path: '/users/:_id/_create', controller: 'security', action: 'createUser' },
  { verb: 'post', path: '/profiles/_mDelete', controller: 'security', action: 'mDeleteProfiles' },
  { verb: 'post', path: '/roles/_mDelete', controller: 'security', action: 'mDeleteRoles' },
  { verb: 'post', path: '/users/_mDelete', controller: 'security', action: 'mDeleteUsers' },
  { verb: 'post', path: '/profiles/_mGet', controller: 'security', action: 'mGetProfiles' },
  { verb: 'post', path: '/users/_mGet', controller: 'security', action: 'mGetUsers' },
  { verb: 'post', path: '/roles/_mGet', controller: 'security', action: 'mGetRoles' },
  { verb: 'post', path: '/profiles/_search', controller: 'security', action: 'searchProfiles' },
  { verb: 'post', path: '/roles/_search', controller: 'security', action: 'searchRoles' },
  { verb: 'post', path: '/users/_search', controller: 'security', action: 'searchUsers' },
  { verb: 'post', path: '/credentials/:strategy/users/_search', controller: 'security', action: 'searchUsersByCredentials' },
  { verb: 'post', path: '/users/:_id/_upsert', controller: 'security', action: 'upsertUser' },
  { verb: 'post', path: '/credentials/:strategy/:_id/_validate', controller: 'security', action: 'validateCredentials' },
  { verb: 'post', path: '/_checkRights', controller: 'auth', action: 'checkRights' },
  { verb: 'post', path: '/_checkRights/:userId', controller: 'security', action: 'checkRights' },

  { verb: 'post', path: '/users/:userId/api-keys/_create', controller: 'security', action: 'createApiKey' },
  { verb: 'post', path: '/users/:userId/api-keys/_search', controller: 'security', action: 'searchApiKeys' },

  { verb: 'post', path: '/api-keys/_create', controller: 'auth', action: 'createApiKey' },
  { verb: 'post', path: '/api-keys/_search', controller: 'auth', action: 'searchApiKeys' },

  { verb: 'post', path: '/ms/_append/:_id', controller: 'ms', action: 'append' },
  { verb: 'post', path: '/ms/_bgrewriteaof', controller: 'ms', action: 'bgrewriteaof' },
  { verb: 'post', path: '/ms/_bgsave', controller: 'ms', action: 'bgsave' },
  { verb: 'post', path: '/ms/_bitop/:_id', controller: 'ms', action: 'bitop' },
  { verb: 'post', path: '/ms/_decr/:_id', controller: 'ms', action: 'decr' },
  { verb: 'post', path: '/ms/_decrby/:_id', controller: 'ms', action: 'decrby' },
  { verb: 'post', path: '/ms/_expire/:_id', controller: 'ms', action: 'expire' },
  { verb: 'post', path: '/ms/_expireat/:_id', controller: 'ms', action: 'expireat' },
  { verb: 'post', path: '/ms/_flushdb', controller: 'ms', action: 'flushdb' },
  { verb: 'post', path: '/ms/_geoadd/:_id', controller: 'ms', action: 'geoadd' },
  { verb: 'post', path: '/ms/_getset/:_id', controller: 'ms', action: 'getset' },
  { verb: 'post', path: '/ms/_hincrby/:_id', controller: 'ms', action: 'hincrby' },
  { verb: 'post', path: '/ms/_hincrbyfloat/:_id', controller: 'ms', action: 'hincrbyfloat' },
  { verb: 'post', path: '/ms/_hmset/:_id', controller: 'ms', action: 'hmset' },
  { verb: 'post', path: '/ms/_hset/:_id', controller: 'ms', action: 'hset' },
  { verb: 'post', path: '/ms/_hsetnx/:_id', controller: 'ms', action: 'hsetnx' },
  { verb: 'post', path: '/ms/_incr/:_id', controller: 'ms', action: 'incr' },
  { verb: 'post', path: '/ms/_incrby/:_id', controller: 'ms', action: 'incrby' },
  { verb: 'post', path: '/ms/_incrbyfloat/:_id', controller: 'ms', action: 'incrbyfloat' },
  { verb: 'post', path: '/ms/_linsert/:_id', controller: 'ms', action: 'linsert' },
  { verb: 'post', path: '/ms/_lpop/:_id', controller: 'ms', action: 'lpop' },
  { verb: 'post', path: '/ms/_lpush/:_id', controller: 'ms', action: 'lpush' },
  { verb: 'post', path: '/ms/_lpushx/:_id', controller: 'ms', action: 'lpushx' },
  { verb: 'post', path: '/ms/_lset/:_id', controller: 'ms', action: 'lset' },
  { verb: 'post', path: '/ms/_ltrim/:_id', controller: 'ms', action: 'ltrim' },
  { verb: 'post', path: '/ms/_mexecute', controller: 'ms', action: 'mexecute' },
  { verb: 'post', path: '/ms/_mset', controller: 'ms', action: 'mset' },
  { verb: 'post', path: '/ms/_msetnx', controller: 'ms', action: 'msetnx' },
  { verb: 'post', path: '/ms/_persist/:_id', controller: 'ms', action: 'persist' },
  { verb: 'post', path: '/ms/_pexpire/:_id', controller: 'ms', action: 'pexpire' },
  { verb: 'post', path: '/ms/_pexpireat/:_id', controller: 'ms', action: 'pexpireat' },
  { verb: 'post', path: '/ms/_pfadd/:_id', controller: 'ms', action: 'pfadd' },
  { verb: 'post', path: '/ms/_pfmerge/:_id', controller: 'ms', action: 'pfmerge' },
  { verb: 'post', path: '/ms/_psetex/:_id', controller: 'ms', action: 'psetex' },
  { verb: 'post', path: '/ms/_rename/:_id', controller: 'ms', action: 'rename' },
  { verb: 'post', path: '/ms/_renamenx/:_id', controller: 'ms', action: 'renamenx' },
  { verb: 'post', path: '/ms/_rpop/:_id', controller: 'ms', action: 'rpop' },
  { verb: 'post', path: '/ms/_rpoplpush', controller: 'ms', action: 'rpoplpush' },
  { verb: 'post', path: '/ms/_rpush/:_id', controller: 'ms', action: 'rpush' },
  { verb: 'post', path: '/ms/_rpushx/:_id', controller: 'ms', action: 'rpushx' },
  { verb: 'post', path: '/ms/_sadd/:_id', controller: 'ms', action: 'sadd' },
  { verb: 'post', path: '/ms/_sdiffstore/:_id', controller: 'ms', action: 'sdiffstore' },
  { verb: 'post', path: '/ms/_set/:_id', controller: 'ms', action: 'set' },
  { verb: 'post', path: '/ms/_setex/:_id', controller: 'ms', action: 'setex' },
  { verb: 'post', path: '/ms/_setnx/:_id', controller: 'ms', action: 'setnx' },
  { verb: 'post', path: '/ms/_sinterstore', controller: 'ms', action: 'sinterstore' },
  { verb: 'post', path: '/ms/_smove/:_id', controller: 'ms', action: 'smove' },
  { verb: 'post', path: '/ms/_sort/:_id', controller: 'ms', action: 'sort' },
  { verb: 'post', path: '/ms/_spop/:_id', controller: 'ms', action: 'spop' },
  { verb: 'post', path: '/ms/_sunionstore', controller: 'ms', action: 'sunionstore' },
  { verb: 'post', path: '/ms/_touch', controller: 'ms', action: 'touch' },
  { verb: 'post', path: '/ms/_zadd/:_id', controller: 'ms', action: 'zadd' },
  { verb: 'post', path: '/ms/_zincrby/:_id', controller: 'ms', action: 'zincrby' },
  { verb: 'post', path: '/ms/_zinterstore/:_id', controller: 'ms', action: 'zinterstore' },
  { verb: 'post', path: '/ms/_zunionstore/:_id', controller: 'ms', action: 'zunionstore' },


  // DELETE
  { verb: 'delete', path: '/_me/credentials/:strategy', controller: 'auth', action: 'deleteMyCredentials' },

  { verb: 'delete', path: '/credentials/:strategy/_me', controller: 'auth', action: 'deleteMyCredentials', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me/credentials/:strategy' } }, // @deprecated

  { verb: 'delete', path: '/:index/:collection/_specifications', controller: 'collection', action: 'deleteSpecifications' },
  { verb: 'delete', path: '/:index/:collection/_truncate', controller: 'collection', action: 'truncate' },

  { verb: 'delete', path: '/:index/:collection/:_id', controller: 'document', action: 'delete', openapi: OpenApiDocumentDelete },
  { verb: 'delete', path: '/:index/:collection/:_id/_fields', controller: 'document', action: 'deleteFields' },
  { verb: 'delete', path: '/:index/:collection/_query', controller: 'document', action: 'deleteByQuery', openapi: OpenApiDocumentDeleteByQuery },
  { verb: 'delete', path: '/:index/:collection/_bulk/_query', controller: 'bulk', action: 'deleteByQuery' },

  { verb: 'delete', path: '/:index/:collection/_mDelete', controller: 'document', action: 'mDelete' },

  { verb: 'delete', path: '/:index', controller: 'index', action: 'delete' },
  { verb: 'delete', path: '/_mDelete', controller: 'index', action: 'mDelete' },
  { verb: 'delete', path: '/_mdelete', controller: 'index', action: 'mDelete', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_mDelete' } }, // @deprecated

  { verb: 'delete', path: '/:index/:collection', controller: 'collection', action: 'delete' },

  { verb: 'delete', path: '/profiles/:_id', controller: 'security', action: 'deleteProfile' },
  { verb: 'delete', path: '/roles/:_id', controller: 'security', action: 'deleteRole' },
  { verb: 'delete', path: '/users/:_id', controller: 'security', action: 'deleteUser' },
  { verb: 'delete', path: '/credentials/:strategy/:_id', controller: 'security', action: 'deleteCredentials' },
  { verb: 'delete', path: '/users/:_id/tokens', controller: 'security', action: 'revokeTokens' },

  { verb: 'delete', path: '/ms', controller: 'ms', action: 'del' },
  { verb: 'delete', path: '/ms/_hdel/:_id', controller: 'ms', action: 'hdel' },
  { verb: 'delete', path: '/ms/_lrem/:_id', controller: 'ms', action: 'lrem' },
  { verb: 'delete', path: '/ms/_srem/:_id', controller: 'ms', action: 'srem' },
  { verb: 'delete', path: '/ms/_zrem/:_id', controller: 'ms', action: 'zrem' },
  { verb: 'delete', path: '/ms/_zremrangebylex/:_id', controller: 'ms', action: 'zremrangebylex' },
  { verb: 'delete', path: '/ms/_zremrangebyrank/:_id', controller: 'ms', action: 'zremrangebyrank' },
  { verb: 'delete', path: '/ms/_zremrangebyscore/:_id', controller: 'ms', action: 'zremrangebyscore' },

  { verb: 'delete', path: '/users/:userId/api-keys/:_id', controller: 'security', action: 'deleteApiKey' },
  { verb: 'delete', path: '/api-keys/:_id', controller: 'auth', action: 'deleteApiKey' },


  // PUT (idempotent)
  { verb: 'put', path: '/_me', controller: 'auth', action: 'updateSelf' },
  { verb: 'put', path: '/_me/credentials/:strategy/_update', controller: 'auth', action: 'updateMyCredentials' },

  { verb: 'put', path: '/_updateSelf', controller: 'auth', action: 'updateSelf', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me' } }, // @deprecated
  { verb: 'put', path: '/credentials/:strategy/_me/_update', controller: 'auth', action: 'updateMyCredentials', deprecated: { since: '2.4.0', message: 'Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_update' } }, // @deprecated

  { verb: 'put', path: '/:index/:collection', controller: 'collection', action: 'create' },
  { verb: 'post', path: '/:index/:collection', controller: 'collection', action: 'update' },
  { verb: 'put', path: '/:index/:collection/_mapping', controller: 'collection', action: 'updateMapping', deprecated: { since: '2.1.0', message: 'Use collection:update' } }, // @deprecated

  { verb: 'put', path: '/:index/:collection/_specifications', controller: 'collection', action: 'updateSpecifications' },

  { verb: 'put', path: '/:index/:collection/:_id', controller: 'document', action: 'createOrReplace', openapi: OpenApiDocumentCreateOrReplace },
  { verb: 'put', path: '/:index/:collection/_mCreateOrReplace', controller: 'document', action: 'mCreateOrReplace' },
  { verb: 'put', path: '/:index/:collection/:_id/_replace', controller: 'document', action: 'replace', openapi: OpenApiDocumentReplace },
  { verb: 'put', path: '/:index/:collection/_mReplace', controller: 'document', action: 'mReplace' },
  { verb: 'put', path: '/:index/:collection/_mUpdate', controller: 'document', action: 'mUpdate', deprecated: { since: '2.11.0', message: 'Use "document:mUpdate" route with PATCH instead of PUT' } }, // @deprecated
  { verb: 'put', path: '/:index/:collection/:_id/_update', controller: 'document', action: 'update', openapi: OpenApiDocumentUpdate, deprecated: { since: '2.11.0', message: 'Use "document:update" route with PATCH instead of PUT' } }, // @deprecated
  { verb: 'put', path: '/:index/:collection/:_id/_upsert', controller: 'document', action: 'upsert', deprecated: { since: '2.11.0', message: 'Use "document:upsert" route with POST instead of PUT' } }, // @deprecated
  { verb: 'put', path: '/:index/:collection/_query', controller: 'document', action: 'updateByQuery' },

  { verb: 'put', path: '/profiles/:_id', controller: 'security', action: 'createOrReplaceProfile' },
  { verb: 'put', path: '/roles/:_id', controller: 'security', action: 'createOrReplaceRole' },
  { verb: 'put', path: '/credentials/:strategy/:_id/_update', controller: 'security', action: 'updateCredentials', },
  { verb: 'put', path: '/profiles/:_id/_update', controller: 'security', action: 'updateProfile' },
  { verb: 'put', path: '/roles/:_id/_update', controller: 'security', action: 'updateRole' },
  { verb: 'put', path: '/users/:_id/_update', controller: 'security', action: 'updateUser' },
  { verb: 'put', path: '/users/:_id/_replace', controller: 'security', action: 'replaceUser' },
  { verb: 'put', path: '/profiles/_mapping', controller: 'security', action: 'updateProfileMapping' },
  { verb: 'put', path: '/roles/_mapping', controller: 'security', action: 'updateRoleMapping' },
  { verb: 'put', path: '/users/_mapping', controller: 'security', action: 'updateUserMapping' },

  // PATCH
  { verb: 'patch', path: '/:index/:collection/_mUpdate', controller: 'document', action: 'mUpdate' },
  { verb: 'patch', path: '/:index/:collection/:_id/_update', controller: 'document', action: 'update' },
  { verb: 'patch', path: '/:index/:collection/_bulk/_query', controller: 'bulk', action: 'updateByQuery' },
];

for (const route of routes) {
  route.url = route.path;
}

module.exports = routes;
