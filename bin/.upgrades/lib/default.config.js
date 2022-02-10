module.exports = {
  "realtime": {
    "pcreSupport": false
  },
  "dump": {
    "enabled": false,
    "history": {
      "coredump": 3,
      "reports": 5
    },
    "path": "./dump/",
    "gcore": "gcore",
    "dateFormat": "YYYYMMDD-HHmmss",
    "handledErrors": {
      "enabled": true,
      "whitelist": [
        "RangeError",
        "TypeError",
        "KuzzleError",
        "InternalError"
      ],
      "minInterval": 600000
    }
  },
  "http": {
    "routes": [
      {
        "verb": "get",
        "path": "/_me",
        "controller": "auth",
        "action": "getCurrentUser",
        "url": "/_me"
      },
      {
        "verb": "get",
        "path": "/_me/_rights",
        "controller": "auth",
        "action": "getMyRights",
        "url": "/_me/_rights"
      },
      {
        "verb": "get",
        "path": "/_me/credentials/:strategy",
        "controller": "auth",
        "action": "getMyCredentials",
        "url": "/_me/credentials/:strategy"
      },
      {
        "verb": "get",
        "path": "/_me/credentials/:strategy/_exists",
        "controller": "auth",
        "action": "credentialsExist",
        "url": "/_me/credentials/:strategy/_exists"
      },
      {
        "verb": "get",
        "path": "/strategies",
        "controller": "auth",
        "action": "getStrategies",
        "url": "/strategies"
      },
      {
        "verb": "get",
        "path": "/users/_me",
        "controller": "auth",
        "action": "getCurrentUser",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me"
        },
        "url": "/users/_me"
      },
      {
        "verb": "get",
        "path": "/users/_me/_rights",
        "controller": "auth",
        "action": "getMyRights",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me/_rights"
        },
        "url": "/users/_me/_rights"
      },
      {
        "verb": "get",
        "path": "/credentials/:strategy/_me",
        "controller": "auth",
        "action": "getMyCredentials",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me/credentials/:strategy"
        },
        "url": "/credentials/:strategy/_me"
      },
      {
        "verb": "get",
        "path": "/credentials/:strategy/_me/_exists",
        "controller": "auth",
        "action": "credentialsExist",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_exists"
        },
        "url": "/credentials/:strategy/_me/_exists"
      },
      {
        "verb": "get",
        "path": "/_login/:strategy",
        "controller": "auth",
        "action": "login",
        "url": "/_login/:strategy"
      },
      {
        "verb": "get",
        "path": "/:index/:collection/_exists",
        "controller": "collection",
        "action": "exists",
        "url": "/:index/:collection/_exists"
      },
      {
        "verb": "get",
        "path": "/:index/:collection/_mapping",
        "controller": "collection",
        "action": "getMapping",
        "url": "/:index/:collection/_mapping"
      },
      {
        "verb": "get",
        "path": "/:index/:collection/_search",
        "controller": "document",
        "action": "search",
        "url": "/:index/:collection/_search"
      },
      {
        "verb": "get",
        "path": "/:index/:collection/_specifications",
        "controller": "collection",
        "action": "getSpecifications",
        "url": "/:index/:collection/_specifications"
      },
      {
        "verb": "get",
        "path": "/validations/_scroll/:scrollId",
        "controller": "collection",
        "action": "scrollSpecifications",
        "url": "/validations/_scroll/:scrollId"
      },
      {
        "verb": "get",
        "path": "/:index/_list",
        "controller": "collection",
        "action": "list",
        "url": "/:index/_list"
      },
      {
        "verb": "post",
        "path": "/admin/_refreshIndexCache",
        "controller": "admin",
        "action": "refreshIndexCache",
        "url": "/admin/_refreshIndexCache"
      },
      {
        "verb": "post",
        "path": "/admin/_resetCache",
        "controller": "admin",
        "action": "resetCache",
        "url": "/admin/_resetCache"
      },
      {
        "verb": "post",
        "path": "/admin/_resetSecurity",
        "controller": "admin",
        "action": "resetSecurity",
        "url": "/admin/_resetSecurity"
      },
      {
        "verb": "post",
        "path": "/admin/_resetDatabase",
        "controller": "admin",
        "action": "resetDatabase",
        "url": "/admin/_resetDatabase"
      },
      {
        "verb": "post",
        "path": "/admin/_resetKuzzleData",
        "controller": "admin",
        "action": "resetKuzzleData",
        "url": "/admin/_resetKuzzleData"
      },
      {
        "verb": "post",
        "path": "/admin/_dump",
        "controller": "admin",
        "action": "dump",
        "url": "/admin/_dump"
      },
      {
        "verb": "post",
        "path": "/admin/_shutdown/",
        "controller": "admin",
        "action": "shutdown",
        "url": "/admin/_shutdown/"
      },
      {
        "verb": "post",
        "path": "/admin/_loadFixtures",
        "controller": "admin",
        "action": "loadFixtures",
        "url": "/admin/_loadFixtures"
      },
      {
        "verb": "post",
        "path": "/admin/_loadMappings",
        "controller": "admin",
        "action": "loadMappings",
        "url": "/admin/_loadMappings"
      },
      {
        "verb": "post",
        "path": "/admin/_loadSecurities",
        "controller": "admin",
        "action": "loadSecurities",
        "url": "/admin/_loadSecurities"
      },
      {
        "verb": "get",
        "path": "/:index/:collection/:_id",
        "controller": "document",
        "action": "get",
        "openapi": {
          "summary": "Gets a document.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "documentId",
              "schema": {
                "type": "string"
              },
              "required": true
            }
          ],
          "responses": {
            "200": {
              "description": "Gets a document.",
              "schema": {
                "$ref": "#/components/schemas/DocumentGetResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/:_id"
      },
      {
        "verb": "get",
        "path": "/:index/:collection/_mGet",
        "controller": "document",
        "action": "mGet",
        "url": "/:index/:collection/_mGet"
      },
      {
        "verb": "get",
        "path": "/:index/:collection/:_id/_exists",
        "controller": "document",
        "action": "exists",
        "openapi": {
          "summary": "Checks if a document exists.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "_id",
              "schema": {
                "type": "integer"
              },
              "required": true
            }
          ],
          "responses": {
            "200": {
              "description": "Checks if a document exists.",
              "schema": {
                "$ref": "#/components/schemas/DocumentExistsResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/:_id/_exists"
      },
      {
        "verb": "get",
        "path": "/_scroll/:scrollId",
        "controller": "document",
        "action": "scroll",
        "openapi": {
          "summary": "Moves a search cursor forward.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "scrollId",
              "schema": {
                "type": "integer"
              },
              "description": "cursor unique identifier, obtained by either a search or a scroll query",
              "required": true
            },
            {
              "in": "path",
              "name": "scroll",
              "schema": {
                "type": "integer"
              },
              "description": "refresh the cursor duration, using the time to live syntax.",
              "required": false
            }
          ],
          "responses": {
            "200": {
              "description": "Moves a search cursor forward.",
              "schema": {
                "$ref": "#/components/schemas/DocumentScrollResponse"
              }
            }
          }
        },
        "url": "/_scroll/:scrollId"
      },
      {
        "verb": "get",
        "path": "/:index/_exists",
        "controller": "index",
        "action": "exists",
        "url": "/:index/_exists"
      },
      {
        "verb": "get",
        "path": "/:index/_autoRefresh",
        "controller": "index",
        "action": "getAutoRefresh",
        "url": "/:index/_autoRefresh"
      },
      {
        "verb": "get",
        "path": "/_list",
        "controller": "index",
        "action": "list",
        "url": "/_list"
      },
      {
        "verb": "get",
        "path": "/_storageStats",
        "controller": "index",
        "action": "stats",
        "url": "/_storageStats"
      },
      {
        "verb": "get",
        "path": "/_listSubscriptions",
        "controller": "realtime",
        "action": "list",
        "url": "/_listSubscriptions"
      },
      {
        "verb": "get",
        "path": "/profiles/:_id",
        "controller": "security",
        "action": "getProfile",
        "url": "/profiles/:_id"
      },
      {
        "verb": "get",
        "path": "/profiles/:_id/_rights",
        "controller": "security",
        "action": "getProfileRights",
        "url": "/profiles/:_id/_rights"
      },
      {
        "verb": "get",
        "path": "/roles/:_id",
        "controller": "security",
        "action": "getRole",
        "url": "/roles/:_id"
      },
      {
        "verb": "get",
        "path": "/users/:_id",
        "controller": "security",
        "action": "getUser",
        "url": "/users/:_id"
      },
      {
        "verb": "get",
        "path": "/users/:_id/_strategies",
        "controller": "security",
        "action": "getUserStrategies",
        "url": "/users/:_id/_strategies"
      },
      {
        "verb": "get",
        "path": "/users/_mGet",
        "controller": "security",
        "action": "mGetUsers",
        "url": "/users/_mGet"
      },
      {
        "verb": "get",
        "path": "/users/:_id/_rights",
        "controller": "security",
        "action": "getUserRights",
        "url": "/users/:_id/_rights"
      },
      {
        "verb": "get",
        "path": "/profiles/_mapping",
        "controller": "security",
        "action": "getProfileMapping",
        "url": "/profiles/_mapping"
      },
      {
        "verb": "get",
        "path": "/roles/_mapping",
        "controller": "security",
        "action": "getRoleMapping",
        "url": "/roles/_mapping"
      },
      {
        "verb": "get",
        "path": "/users/_mapping",
        "controller": "security",
        "action": "getUserMapping",
        "url": "/users/_mapping"
      },
      {
        "verb": "get",
        "path": "/users/_scroll/:scrollId",
        "controller": "security",
        "action": "scrollUsers",
        "url": "/users/_scroll/:scrollId"
      },
      {
        "verb": "get",
        "path": "/credentials/:strategy/:_id",
        "controller": "security",
        "action": "getCredentials",
        "url": "/credentials/:strategy/:_id"
      },
      {
        "verb": "get",
        "path": "/credentials/:strategy/:_id/_byId",
        "controller": "security",
        "action": "getCredentialsById",
        "url": "/credentials/:strategy/:_id/_byId"
      },
      {
        "verb": "get",
        "path": "/credentials/:strategy/:_id/_exists",
        "controller": "security",
        "action": "hasCredentials",
        "url": "/credentials/:strategy/:_id/_exists"
      },
      {
        "verb": "get",
        "path": "/credentials/:strategy/_fields",
        "controller": "security",
        "action": "getCredentialFields",
        "url": "/credentials/:strategy/_fields"
      },
      {
        "verb": "get",
        "path": "/credentials/_fields",
        "controller": "security",
        "action": "getAllCredentialFields",
        "url": "/credentials/_fields"
      },
      {
        "verb": "get",
        "path": "/profiles/_scroll/:scrollId",
        "controller": "security",
        "action": "scrollProfiles",
        "url": "/profiles/_scroll/:scrollId"
      },
      {
        "verb": "get",
        "path": "/_adminExists",
        "controller": "server",
        "action": "adminExists",
        "url": "/_adminExists"
      },
      {
        "verb": "get",
        "path": "/_getAllStats",
        "controller": "server",
        "action": "getAllStats",
        "deprecated": {
          "since": "auto-version",
          "message": "Use this route instead: http://kuzzle:7512/_metrics"
        },
        "url": "/_getAllStats"
      },
      {
        "verb": "get",
        "path": "/_getConfig",
        "controller": "server",
        "action": "getConfig",
        "url": "/_getConfig"
      },
      {
        "verb": "get",
        "path": "/_getLastStats",
        "controller": "server",
        "action": "getLastStats",
        "deprecated": {
          "since": "auto-version",
          "message": "Use this route instead: http://kuzzle:7512/_metrics"
        },
        "url": "/_getLastStats"
      },
      {
        "verb": "get",
        "path": "/_getStats",
        "controller": "server",
        "action": "getStats",
        "deprecated": {
          "since": "auto-version",
          "message": "Use this route instead: http://kuzzle:7512/_metrics"
        },
        "url": "/_getStats"
      },
      {
        "verb": "get",
        "path": "/",
        "controller": "server",
        "action": "info",
        "url": "/"
      },
      {
        "verb": "get",
        "path": "/_healthCheck",
        "controller": "server",
        "action": "healthCheck",
        "url": "/_healthCheck"
      },
      {
        "verb": "get",
        "path": "/_serverInfo",
        "controller": "server",
        "action": "info",
        "url": "/_serverInfo"
      },
      {
        "verb": "get",
        "path": "/_now",
        "controller": "server",
        "action": "now",
        "url": "/_now"
      },
      {
        "verb": "get",
        "path": "/_publicApi",
        "controller": "server",
        "action": "publicApi",
        "deprecated": {
          "since": "2.5.0",
          "message": "Use this route instead: http://kuzzle:7512/_openapi"
        },
        "url": "/_publicApi"
      },
      {
        "verb": "get",
        "path": "/_openapi",
        "controller": "server",
        "action": "openapi",
        "url": "/_openapi"
      },
      {
        "verb": "get",
        "path": "/_metrics",
        "controller": "server",
        "action": "metrics",
        "url": "/_metrics"
      },
      {
        "verb": "get",
        "path": "/ms/_bitcount/:_id",
        "controller": "ms",
        "action": "bitcount",
        "url": "/ms/_bitcount/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_bitpos/:_id",
        "controller": "ms",
        "action": "bitpos",
        "url": "/ms/_bitpos/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_dbsize",
        "controller": "ms",
        "action": "dbsize",
        "url": "/ms/_dbsize"
      },
      {
        "verb": "get",
        "path": "/ms/_getbit/:_id",
        "controller": "ms",
        "action": "getbit",
        "url": "/ms/_getbit/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_getrange/:_id",
        "controller": "ms",
        "action": "getrange",
        "url": "/ms/_getrange/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_exists",
        "controller": "ms",
        "action": "exists",
        "url": "/ms/_exists"
      },
      {
        "verb": "get",
        "path": "/ms/_geodist/:_id/:member1/:member2",
        "controller": "ms",
        "action": "geodist",
        "url": "/ms/_geodist/:_id/:member1/:member2"
      },
      {
        "verb": "get",
        "path": "/ms/_geohash/:_id",
        "controller": "ms",
        "action": "geohash",
        "url": "/ms/_geohash/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_geopos/:_id",
        "controller": "ms",
        "action": "geopos",
        "url": "/ms/_geopos/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_georadius/:_id",
        "controller": "ms",
        "action": "georadius",
        "url": "/ms/_georadius/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_georadiusbymember/:_id",
        "controller": "ms",
        "action": "georadiusbymember",
        "url": "/ms/_georadiusbymember/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_hexists/:_id/:field",
        "controller": "ms",
        "action": "hexists",
        "url": "/ms/_hexists/:_id/:field"
      },
      {
        "verb": "get",
        "path": "/ms/_hget/:_id/:field",
        "controller": "ms",
        "action": "hget",
        "url": "/ms/_hget/:_id/:field"
      },
      {
        "verb": "get",
        "path": "/ms/_hgetall/:_id",
        "controller": "ms",
        "action": "hgetall",
        "url": "/ms/_hgetall/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_hkeys/:_id",
        "controller": "ms",
        "action": "hkeys",
        "url": "/ms/_hkeys/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_hlen/:_id",
        "controller": "ms",
        "action": "hlen",
        "url": "/ms/_hlen/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_hmget/:_id",
        "controller": "ms",
        "action": "hmget",
        "url": "/ms/_hmget/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_hscan/:_id",
        "controller": "ms",
        "action": "hscan",
        "url": "/ms/_hscan/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_hstrlen/:_id/:field",
        "controller": "ms",
        "action": "hstrlen",
        "url": "/ms/_hstrlen/:_id/:field"
      },
      {
        "verb": "get",
        "path": "/ms/_hvals/:_id",
        "controller": "ms",
        "action": "hvals",
        "url": "/ms/_hvals/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_keys/:pattern",
        "controller": "ms",
        "action": "keys",
        "url": "/ms/_keys/:pattern"
      },
      {
        "verb": "get",
        "path": "/ms/_lindex/:_id/:idx",
        "controller": "ms",
        "action": "lindex",
        "url": "/ms/_lindex/:_id/:idx"
      },
      {
        "verb": "get",
        "path": "/ms/_llen/:_id",
        "controller": "ms",
        "action": "llen",
        "url": "/ms/_llen/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_lrange/:_id",
        "controller": "ms",
        "action": "lrange",
        "url": "/ms/_lrange/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_mget",
        "controller": "ms",
        "action": "mget",
        "url": "/ms/_mget"
      },
      {
        "verb": "get",
        "path": "/ms/_object/:_id",
        "controller": "ms",
        "action": "object",
        "url": "/ms/_object/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_pfcount",
        "controller": "ms",
        "action": "pfcount",
        "url": "/ms/_pfcount"
      },
      {
        "verb": "get",
        "path": "/ms/_ping",
        "controller": "ms",
        "action": "ping",
        "url": "/ms/_ping"
      },
      {
        "verb": "get",
        "path": "/ms/_pttl/:_id",
        "controller": "ms",
        "action": "pttl",
        "url": "/ms/_pttl/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_randomkey",
        "controller": "ms",
        "action": "randomkey",
        "url": "/ms/_randomkey"
      },
      {
        "verb": "get",
        "path": "/ms/_scan",
        "controller": "ms",
        "action": "scan",
        "url": "/ms/_scan"
      },
      {
        "verb": "get",
        "path": "/ms/_scard/:_id",
        "controller": "ms",
        "action": "scard",
        "url": "/ms/_scard/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_sdiff/:_id",
        "controller": "ms",
        "action": "sdiff",
        "url": "/ms/_sdiff/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_sinter",
        "controller": "ms",
        "action": "sinter",
        "url": "/ms/_sinter"
      },
      {
        "verb": "get",
        "path": "/ms/_sismember/:_id/:member",
        "controller": "ms",
        "action": "sismember",
        "url": "/ms/_sismember/:_id/:member"
      },
      {
        "verb": "get",
        "path": "/ms/_smembers/:_id",
        "controller": "ms",
        "action": "smembers",
        "url": "/ms/_smembers/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_srandmember/:_id",
        "controller": "ms",
        "action": "srandmember",
        "url": "/ms/_srandmember/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_sscan/:_id",
        "controller": "ms",
        "action": "sscan",
        "url": "/ms/_sscan/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_strlen/:_id",
        "controller": "ms",
        "action": "strlen",
        "url": "/ms/_strlen/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_sunion",
        "controller": "ms",
        "action": "sunion",
        "url": "/ms/_sunion"
      },
      {
        "verb": "get",
        "path": "/ms/_time",
        "controller": "ms",
        "action": "time",
        "url": "/ms/_time"
      },
      {
        "verb": "get",
        "path": "/ms/_ttl/:_id",
        "controller": "ms",
        "action": "ttl",
        "url": "/ms/_ttl/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_type/:_id",
        "controller": "ms",
        "action": "type",
        "url": "/ms/_type/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zcard/:_id",
        "controller": "ms",
        "action": "zcard",
        "url": "/ms/_zcard/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zcount/:_id",
        "controller": "ms",
        "action": "zcount",
        "url": "/ms/_zcount/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zlexcount/:_id",
        "controller": "ms",
        "action": "zlexcount",
        "url": "/ms/_zlexcount/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zrange/:_id",
        "controller": "ms",
        "action": "zrange",
        "url": "/ms/_zrange/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zrangebylex/:_id",
        "controller": "ms",
        "action": "zrangebylex",
        "url": "/ms/_zrangebylex/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zrevrangebylex/:_id",
        "controller": "ms",
        "action": "zrevrangebylex",
        "url": "/ms/_zrevrangebylex/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zrangebyscore/:_id",
        "controller": "ms",
        "action": "zrangebyscore",
        "url": "/ms/_zrangebyscore/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zrank/:_id/:member",
        "controller": "ms",
        "action": "zrank",
        "url": "/ms/_zrank/:_id/:member"
      },
      {
        "verb": "get",
        "path": "/ms/_zrevrange/:_id",
        "controller": "ms",
        "action": "zrevrange",
        "url": "/ms/_zrevrange/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zrevrangebyscore/:_id",
        "controller": "ms",
        "action": "zrevrangebyscore",
        "url": "/ms/_zrevrangebyscore/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zrevrank/:_id/:member",
        "controller": "ms",
        "action": "zrevrank",
        "url": "/ms/_zrevrank/:_id/:member"
      },
      {
        "verb": "get",
        "path": "/ms/_zscan/:_id",
        "controller": "ms",
        "action": "zscan",
        "url": "/ms/_zscan/:_id"
      },
      {
        "verb": "get",
        "path": "/ms/_zscore/:_id/:member",
        "controller": "ms",
        "action": "zscore",
        "url": "/ms/_zscore/:_id/:member"
      },
      {
        "verb": "get",
        "path": "/ms/:_id",
        "controller": "ms",
        "action": "get",
        "url": "/ms/:_id"
      },
      {
        "verb": "get",
        "path": "/cluster/_status",
        "controller": "cluster",
        "action": "status",
        "url": "/cluster/_status"
      },
      {
        "verb": "post",
        "path": "/_login/:strategy",
        "controller": "auth",
        "action": "login",
        "url": "/_login/:strategy"
      },
      {
        "verb": "post",
        "path": "/_logout",
        "controller": "auth",
        "action": "logout",
        "url": "/_logout"
      },
      {
        "verb": "post",
        "path": "/_checkToken",
        "controller": "auth",
        "action": "checkToken",
        "url": "/_checkToken"
      },
      {
        "verb": "post",
        "path": "/_refreshToken",
        "controller": "auth",
        "action": "refreshToken",
        "url": "/_refreshToken"
      },
      {
        "verb": "post",
        "path": "/_me/credentials/:strategy/_create",
        "controller": "auth",
        "action": "createMyCredentials",
        "url": "/_me/credentials/:strategy/_create"
      },
      {
        "verb": "post",
        "path": "/_me/credentials/:strategy/_validate",
        "controller": "auth",
        "action": "validateMyCredentials",
        "url": "/_me/credentials/:strategy/_validate"
      },
      {
        "verb": "post",
        "path": "/credentials/:strategy/_me/_create",
        "controller": "auth",
        "action": "createMyCredentials",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_create"
        },
        "url": "/credentials/:strategy/_me/_create"
      },
      {
        "verb": "post",
        "path": "/credentials/:strategy/_me/_validate",
        "controller": "auth",
        "action": "validateMyCredentials",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_validate"
        },
        "url": "/credentials/:strategy/_me/_validate"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_validateSpecifications",
        "controller": "collection",
        "action": "validateSpecifications",
        "url": "/:index/:collection/_validateSpecifications"
      },
      {
        "verb": "post",
        "path": "/validations/_search",
        "controller": "collection",
        "action": "searchSpecifications",
        "url": "/validations/_search"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_bulk",
        "controller": "bulk",
        "action": "import",
        "url": "/:index/:collection/_bulk"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_mWrite",
        "controller": "bulk",
        "action": "mWrite",
        "url": "/:index/:collection/_mWrite"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_write",
        "controller": "bulk",
        "action": "write",
        "url": "/:index/:collection/_write"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_refresh",
        "controller": "collection",
        "action": "refresh",
        "url": "/:index/:collection/_refresh"
      },
      {
        "verb": "post",
        "path": "/_security/:collection/_refresh",
        "controller": "security",
        "action": "refresh",
        "url": "/_security/:collection/_refresh"
      },
      {
        "verb": "post",
        "path": "/:index/_create",
        "controller": "index",
        "action": "create",
        "url": "/:index/_create"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_count",
        "controller": "document",
        "action": "count",
        "openapi": {
          "summary": "Counts documents in a collection.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              }
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              }
            },
            {
              "in": "body",
              "name": "body",
              "description": "Counts documents in a collection.",
              "required": true,
              "schema": {
                "$ref": "#/components/schemas/DocumentCountRequest"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Counts documents in a collection.",
              "schema": {
                "$ref": "#/components/schemas/DocumentCountResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/_count"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_create",
        "controller": "document",
        "action": "create",
        "openapi": {
          "summary": "Creates a new document in the persistent data storage.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              }
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "body",
              "in": "body",
              "description": "Creates a new document in the persistent data storage.",
              "required": true,
              "schema": {
                "$ref": "#/components/schemas/DocumentCreateRequest"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Creates a new document in the persistent data storage.",
              "schema": {
                "$ref": "#/components/schemas/DocumentCreateResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/_create"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/:_id/_create",
        "controller": "document",
        "action": "create",
        "url": "/:index/:collection/:_id/_create"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_publish",
        "controller": "realtime",
        "action": "publish",
        "url": "/:index/:collection/_publish"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_search",
        "controller": "document",
        "action": "search",
        "url": "/:index/:collection/_search"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_mGet",
        "controller": "document",
        "action": "mGet",
        "url": "/:index/:collection/_mGet"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_mCreate",
        "controller": "document",
        "action": "mCreate",
        "url": "/:index/:collection/_mCreate"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_mUpsert",
        "controller": "document",
        "action": "mUpsert",
        "url": "/:index/:collection/_mUpsert"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/:_id/_upsert",
        "controller": "document",
        "action": "upsert",
        "url": "/:index/:collection/:_id/_upsert"
      },
      {
        "verb": "post",
        "path": "/:index/:collection/_validate",
        "controller": "document",
        "action": "validate",
        "url": "/:index/:collection/_validate"
      },
      {
        "verb": "post",
        "path": "/_createFirstAdmin/:_id",
        "controller": "security",
        "action": "createFirstAdmin",
        "url": "/_createFirstAdmin/:_id"
      },
      {
        "verb": "post",
        "path": "/_createFirstAdmin",
        "controller": "security",
        "action": "createFirstAdmin",
        "url": "/_createFirstAdmin"
      },
      {
        "verb": "post",
        "path": "/credentials/:strategy/:_id/_create",
        "controller": "security",
        "action": "createCredentials",
        "url": "/credentials/:strategy/:_id/_create"
      },
      {
        "verb": "post",
        "path": "/profiles/:_id/_create",
        "controller": "security",
        "action": "createProfile",
        "url": "/profiles/:_id/_create"
      },
      {
        "verb": "post",
        "path": "/roles/:_id/_create",
        "controller": "security",
        "action": "createRole",
        "url": "/roles/:_id/_create"
      },
      {
        "verb": "post",
        "path": "/users/_createRestricted",
        "controller": "security",
        "action": "createRestrictedUser",
        "url": "/users/_createRestricted"
      },
      {
        "verb": "post",
        "path": "/users/:_id/_createRestricted",
        "controller": "security",
        "action": "createRestrictedUser",
        "url": "/users/:_id/_createRestricted"
      },
      {
        "verb": "post",
        "path": "/users/_create",
        "controller": "security",
        "action": "createUser",
        "url": "/users/_create"
      },
      {
        "verb": "post",
        "path": "/users/:_id/_create",
        "controller": "security",
        "action": "createUser",
        "url": "/users/:_id/_create"
      },
      {
        "verb": "post",
        "path": "/profiles/_mDelete",
        "controller": "security",
        "action": "mDeleteProfiles",
        "url": "/profiles/_mDelete"
      },
      {
        "verb": "post",
        "path": "/roles/_mDelete",
        "controller": "security",
        "action": "mDeleteRoles",
        "url": "/roles/_mDelete"
      },
      {
        "verb": "post",
        "path": "/users/_mDelete",
        "controller": "security",
        "action": "mDeleteUsers",
        "url": "/users/_mDelete"
      },
      {
        "verb": "post",
        "path": "/profiles/_mGet",
        "controller": "security",
        "action": "mGetProfiles",
        "url": "/profiles/_mGet"
      },
      {
        "verb": "post",
        "path": "/users/_mGet",
        "controller": "security",
        "action": "mGetUsers",
        "url": "/users/_mGet"
      },
      {
        "verb": "post",
        "path": "/roles/_mGet",
        "controller": "security",
        "action": "mGetRoles",
        "url": "/roles/_mGet"
      },
      {
        "verb": "post",
        "path": "/profiles/_search",
        "controller": "security",
        "action": "searchProfiles",
        "url": "/profiles/_search"
      },
      {
        "verb": "post",
        "path": "/roles/_search",
        "controller": "security",
        "action": "searchRoles",
        "url": "/roles/_search"
      },
      {
        "verb": "post",
        "path": "/users/_search",
        "controller": "security",
        "action": "searchUsers",
        "url": "/users/_search"
      },
      {
        "verb": "post",
        "path": "/credentials/:strategy/users/_search",
        "controller": "security",
        "action": "searchUsersByCredentials",
        "url": "/credentials/:strategy/users/_search"
      },
      {
        "verb": "post",
        "path": "/credentials/:strategy/:_id/_validate",
        "controller": "security",
        "action": "validateCredentials",
        "url": "/credentials/:strategy/:_id/_validate"
      },
      {
        "verb": "post",
        "path": "/_checkRights",
        "controller": "auth",
        "action": "checkRights",
        "url": "/_checkRights"
      },
      {
        "verb": "post",
        "path": "/_checkRights/:userId",
        "controller": "security",
        "action": "checkRights",
        "url": "/_checkRights/:userId"
      },
      {
        "verb": "post",
        "path": "/users/:userId/api-keys/_create",
        "controller": "security",
        "action": "createApiKey",
        "url": "/users/:userId/api-keys/_create"
      },
      {
        "verb": "post",
        "path": "/users/:userId/api-keys/_search",
        "controller": "security",
        "action": "searchApiKeys",
        "url": "/users/:userId/api-keys/_search"
      },
      {
        "verb": "post",
        "path": "/api-keys/_create",
        "controller": "auth",
        "action": "createApiKey",
        "url": "/api-keys/_create"
      },
      {
        "verb": "post",
        "path": "/api-keys/_search",
        "controller": "auth",
        "action": "searchApiKeys",
        "url": "/api-keys/_search"
      },
      {
        "verb": "post",
        "path": "/ms/_append/:_id",
        "controller": "ms",
        "action": "append",
        "url": "/ms/_append/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_bgrewriteaof",
        "controller": "ms",
        "action": "bgrewriteaof",
        "url": "/ms/_bgrewriteaof"
      },
      {
        "verb": "post",
        "path": "/ms/_bgsave",
        "controller": "ms",
        "action": "bgsave",
        "url": "/ms/_bgsave"
      },
      {
        "verb": "post",
        "path": "/ms/_bitop/:_id",
        "controller": "ms",
        "action": "bitop",
        "url": "/ms/_bitop/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_decr/:_id",
        "controller": "ms",
        "action": "decr",
        "url": "/ms/_decr/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_decrby/:_id",
        "controller": "ms",
        "action": "decrby",
        "url": "/ms/_decrby/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_expire/:_id",
        "controller": "ms",
        "action": "expire",
        "url": "/ms/_expire/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_expireat/:_id",
        "controller": "ms",
        "action": "expireat",
        "url": "/ms/_expireat/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_flushdb",
        "controller": "ms",
        "action": "flushdb",
        "url": "/ms/_flushdb"
      },
      {
        "verb": "post",
        "path": "/ms/_geoadd/:_id",
        "controller": "ms",
        "action": "geoadd",
        "url": "/ms/_geoadd/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_getset/:_id",
        "controller": "ms",
        "action": "getset",
        "url": "/ms/_getset/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_hincrby/:_id",
        "controller": "ms",
        "action": "hincrby",
        "url": "/ms/_hincrby/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_hincrbyfloat/:_id",
        "controller": "ms",
        "action": "hincrbyfloat",
        "url": "/ms/_hincrbyfloat/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_hmset/:_id",
        "controller": "ms",
        "action": "hmset",
        "url": "/ms/_hmset/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_hset/:_id",
        "controller": "ms",
        "action": "hset",
        "url": "/ms/_hset/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_hsetnx/:_id",
        "controller": "ms",
        "action": "hsetnx",
        "url": "/ms/_hsetnx/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_incr/:_id",
        "controller": "ms",
        "action": "incr",
        "url": "/ms/_incr/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_incrby/:_id",
        "controller": "ms",
        "action": "incrby",
        "url": "/ms/_incrby/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_incrbyfloat/:_id",
        "controller": "ms",
        "action": "incrbyfloat",
        "url": "/ms/_incrbyfloat/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_linsert/:_id",
        "controller": "ms",
        "action": "linsert",
        "url": "/ms/_linsert/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_lpop/:_id",
        "controller": "ms",
        "action": "lpop",
        "url": "/ms/_lpop/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_lpush/:_id",
        "controller": "ms",
        "action": "lpush",
        "url": "/ms/_lpush/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_lpushx/:_id",
        "controller": "ms",
        "action": "lpushx",
        "url": "/ms/_lpushx/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_lset/:_id",
        "controller": "ms",
        "action": "lset",
        "url": "/ms/_lset/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_ltrim/:_id",
        "controller": "ms",
        "action": "ltrim",
        "url": "/ms/_ltrim/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_mexecute",
        "controller": "ms",
        "action": "mexecute",
        "url": "/ms/_mexecute"
      },
      {
        "verb": "post",
        "path": "/ms/_mset",
        "controller": "ms",
        "action": "mset",
        "url": "/ms/_mset"
      },
      {
        "verb": "post",
        "path": "/ms/_msetnx",
        "controller": "ms",
        "action": "msetnx",
        "url": "/ms/_msetnx"
      },
      {
        "verb": "post",
        "path": "/ms/_persist/:_id",
        "controller": "ms",
        "action": "persist",
        "url": "/ms/_persist/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_pexpire/:_id",
        "controller": "ms",
        "action": "pexpire",
        "url": "/ms/_pexpire/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_pexpireat/:_id",
        "controller": "ms",
        "action": "pexpireat",
        "url": "/ms/_pexpireat/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_pfadd/:_id",
        "controller": "ms",
        "action": "pfadd",
        "url": "/ms/_pfadd/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_pfmerge/:_id",
        "controller": "ms",
        "action": "pfmerge",
        "url": "/ms/_pfmerge/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_psetex/:_id",
        "controller": "ms",
        "action": "psetex",
        "url": "/ms/_psetex/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_rename/:_id",
        "controller": "ms",
        "action": "rename",
        "url": "/ms/_rename/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_renamenx/:_id",
        "controller": "ms",
        "action": "renamenx",
        "url": "/ms/_renamenx/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_rpop/:_id",
        "controller": "ms",
        "action": "rpop",
        "url": "/ms/_rpop/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_rpoplpush",
        "controller": "ms",
        "action": "rpoplpush",
        "url": "/ms/_rpoplpush"
      },
      {
        "verb": "post",
        "path": "/ms/_rpush/:_id",
        "controller": "ms",
        "action": "rpush",
        "url": "/ms/_rpush/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_rpushx/:_id",
        "controller": "ms",
        "action": "rpushx",
        "url": "/ms/_rpushx/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_sadd/:_id",
        "controller": "ms",
        "action": "sadd",
        "url": "/ms/_sadd/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_sdiffstore/:_id",
        "controller": "ms",
        "action": "sdiffstore",
        "url": "/ms/_sdiffstore/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_set/:_id",
        "controller": "ms",
        "action": "set",
        "url": "/ms/_set/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_setex/:_id",
        "controller": "ms",
        "action": "setex",
        "url": "/ms/_setex/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_setnx/:_id",
        "controller": "ms",
        "action": "setnx",
        "url": "/ms/_setnx/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_sinterstore",
        "controller": "ms",
        "action": "sinterstore",
        "url": "/ms/_sinterstore"
      },
      {
        "verb": "post",
        "path": "/ms/_smove/:_id",
        "controller": "ms",
        "action": "smove",
        "url": "/ms/_smove/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_sort/:_id",
        "controller": "ms",
        "action": "sort",
        "url": "/ms/_sort/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_spop/:_id",
        "controller": "ms",
        "action": "spop",
        "url": "/ms/_spop/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_sunionstore",
        "controller": "ms",
        "action": "sunionstore",
        "url": "/ms/_sunionstore"
      },
      {
        "verb": "post",
        "path": "/ms/_touch",
        "controller": "ms",
        "action": "touch",
        "url": "/ms/_touch"
      },
      {
        "verb": "post",
        "path": "/ms/_zadd/:_id",
        "controller": "ms",
        "action": "zadd",
        "url": "/ms/_zadd/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_zincrby/:_id",
        "controller": "ms",
        "action": "zincrby",
        "url": "/ms/_zincrby/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_zinterstore/:_id",
        "controller": "ms",
        "action": "zinterstore",
        "url": "/ms/_zinterstore/:_id"
      },
      {
        "verb": "post",
        "path": "/ms/_zunionstore/:_id",
        "controller": "ms",
        "action": "zunionstore",
        "url": "/ms/_zunionstore/:_id"
      },
      {
        "verb": "delete",
        "path": "/_me/credentials/:strategy",
        "controller": "auth",
        "action": "deleteMyCredentials",
        "url": "/_me/credentials/:strategy"
      },
      {
        "verb": "delete",
        "path": "/credentials/:strategy/_me",
        "controller": "auth",
        "action": "deleteMyCredentials",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me/credentials/:strategy"
        },
        "url": "/credentials/:strategy/_me"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection/_specifications",
        "controller": "collection",
        "action": "deleteSpecifications",
        "url": "/:index/:collection/_specifications"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection/_truncate",
        "controller": "collection",
        "action": "truncate",
        "url": "/:index/:collection/_truncate"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection/:_id",
        "controller": "document",
        "action": "delete",
        "openapi": {
          "summary": "Deletes a document.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "documentId",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "refresh",
              "schema": {
                "type": "string"
              },
              "description": " if set to wait_for, Kuzzle will not respond until the deletion has been indexed",
              "required": false
            },
            {
              "in": "path",
              "name": "source",
              "schema": {
                "type": "boolean"
              },
              "description": "if set to true Kuzzle will return the deleted document body in the response.",
              "required": false
            },
            {
              "in": "path",
              "name": "silent",
              "schema": {
                "type": "boolean"
              },
              "description": "if set, then Kuzzle will not generate notifications. Available since 2.9.2",
              "required": false
            }
          ],
          "responses": {
            "200": {
              "description": "Deletes a document.",
              "schema": {
                "$ref": "#/components/schemas/DocumentDeleteResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/:_id"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection/:_id/_fields",
        "controller": "document",
        "action": "deleteFields",
        "url": "/:index/:collection/:_id/_fields"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection/_query",
        "controller": "document",
        "action": "deleteByQuery",
        "openapi": {
          "summary": "Deletes documents matching the provided search query.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "documentId",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "refresh",
              "schema": {
                "type": "string"
              },
              "description": " if set to wait_for, Kuzzle will not respond until the deletion has been indexed",
              "required": false
            },
            {
              "in": "path",
              "name": "source",
              "schema": {
                "type": "boolean"
              },
              "description": "if set to true Kuzzle will return the deleted document body in the response.",
              "required": false
            },
            {
              "in": "path",
              "name": "silent",
              "schema": {
                "type": "boolean"
              },
              "description": "if set, then Kuzzle will not generate notifications. Available since 2.9.2",
              "required": false
            },
            {
              "in": "path",
              "name": "lang",
              "schema": {
                "type": "string"
              },
              "description": "specify the query language to use. By default, it's elasticsearch but koncorde can also be used.",
              "required": false
            },
            {
              "name": "body",
              "in": "body",
              "description": "Deletes documents matching the provided search query.",
              "required": true,
              "schema": {
                "$ref": "#/components/schemas/DocumentDeleteByQueryRequest"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Deletes documents matching the provided search query.",
              "schema": {
                "$ref": "#/components/schemas/DocumentDeleteByQueryResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/_query"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection/_bulk/_query",
        "controller": "bulk",
        "action": "deleteByQuery",
        "url": "/:index/:collection/_bulk/_query"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection/_mDelete",
        "controller": "document",
        "action": "mDelete",
        "url": "/:index/:collection/_mDelete"
      },
      {
        "verb": "delete",
        "path": "/:index",
        "controller": "index",
        "action": "delete",
        "url": "/:index"
      },
      {
        "verb": "delete",
        "path": "/_mDelete",
        "controller": "index",
        "action": "mDelete",
        "url": "/_mDelete"
      },
      {
        "verb": "delete",
        "path": "/_mdelete",
        "controller": "index",
        "action": "mDelete",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_mDelete"
        },
        "url": "/_mdelete"
      },
      {
        "verb": "delete",
        "path": "/:index/:collection",
        "controller": "collection",
        "action": "delete",
        "url": "/:index/:collection"
      },
      {
        "verb": "delete",
        "path": "/profiles/:_id",
        "controller": "security",
        "action": "deleteProfile",
        "url": "/profiles/:_id"
      },
      {
        "verb": "delete",
        "path": "/roles/:_id",
        "controller": "security",
        "action": "deleteRole",
        "url": "/roles/:_id"
      },
      {
        "verb": "delete",
        "path": "/users/:_id",
        "controller": "security",
        "action": "deleteUser",
        "url": "/users/:_id"
      },
      {
        "verb": "delete",
        "path": "/credentials/:strategy/:_id",
        "controller": "security",
        "action": "deleteCredentials",
        "url": "/credentials/:strategy/:_id"
      },
      {
        "verb": "delete",
        "path": "/users/:_id/tokens",
        "controller": "security",
        "action": "revokeTokens",
        "url": "/users/:_id/tokens"
      },
      {
        "verb": "delete",
        "path": "/ms",
        "controller": "ms",
        "action": "del",
        "url": "/ms"
      },
      {
        "verb": "delete",
        "path": "/ms/_hdel/:_id",
        "controller": "ms",
        "action": "hdel",
        "url": "/ms/_hdel/:_id"
      },
      {
        "verb": "delete",
        "path": "/ms/_lrem/:_id",
        "controller": "ms",
        "action": "lrem",
        "url": "/ms/_lrem/:_id"
      },
      {
        "verb": "delete",
        "path": "/ms/_srem/:_id",
        "controller": "ms",
        "action": "srem",
        "url": "/ms/_srem/:_id"
      },
      {
        "verb": "delete",
        "path": "/ms/_zrem/:_id",
        "controller": "ms",
        "action": "zrem",
        "url": "/ms/_zrem/:_id"
      },
      {
        "verb": "delete",
        "path": "/ms/_zremrangebylex/:_id",
        "controller": "ms",
        "action": "zremrangebylex",
        "url": "/ms/_zremrangebylex/:_id"
      },
      {
        "verb": "delete",
        "path": "/ms/_zremrangebyrank/:_id",
        "controller": "ms",
        "action": "zremrangebyrank",
        "url": "/ms/_zremrangebyrank/:_id"
      },
      {
        "verb": "delete",
        "path": "/ms/_zremrangebyscore/:_id",
        "controller": "ms",
        "action": "zremrangebyscore",
        "url": "/ms/_zremrangebyscore/:_id"
      },
      {
        "verb": "delete",
        "path": "/users/:userId/api-keys/:_id",
        "controller": "security",
        "action": "deleteApiKey",
        "url": "/users/:userId/api-keys/:_id"
      },
      {
        "verb": "delete",
        "path": "/api-keys/:_id",
        "controller": "auth",
        "action": "deleteApiKey",
        "url": "/api-keys/:_id"
      },
      {
        "verb": "put",
        "path": "/_me",
        "controller": "auth",
        "action": "updateSelf",
        "url": "/_me"
      },
      {
        "verb": "put",
        "path": "/_me/credentials/:strategy/_update",
        "controller": "auth",
        "action": "updateMyCredentials",
        "url": "/_me/credentials/:strategy/_update"
      },
      {
        "verb": "put",
        "path": "/_updateSelf",
        "controller": "auth",
        "action": "updateSelf",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me"
        },
        "url": "/_updateSelf"
      },
      {
        "verb": "put",
        "path": "/credentials/:strategy/_me/_update",
        "controller": "auth",
        "action": "updateMyCredentials",
        "deprecated": {
          "since": "2.4.0",
          "message": "Use this route instead: http://kuzzle:7512/_me/credentials/:strategy/_update"
        },
        "url": "/credentials/:strategy/_me/_update"
      },
      {
        "verb": "put",
        "path": "/:index/:collection",
        "controller": "collection",
        "action": "create",
        "url": "/:index/:collection"
      },
      {
        "verb": "post",
        "path": "/:index/:collection",
        "controller": "collection",
        "action": "update",
        "url": "/:index/:collection"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/_mapping",
        "controller": "collection",
        "action": "updateMapping",
        "deprecated": {
          "since": "2.1.0",
          "message": "Use collection:update"
        },
        "url": "/:index/:collection/_mapping"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/_specifications",
        "controller": "collection",
        "action": "updateSpecifications",
        "url": "/:index/:collection/_specifications"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/:_id",
        "controller": "document",
        "action": "createOrReplace",
        "openapi": {
          "summary": "Creates a new document in the persistent data storage, or replaces its content if it already exists.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "_id",
              "schema": {
                "type": "integer"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "refresh",
              "schema": {
                "type": "string"
              },
              "required": false
            },
            {
              "name": "body",
              "in": "body",
              "description": "Creates a new document in the persistent data storage, or replaces its content if it already exists.",
              "required": true,
              "schema": {
                "$ref": "#/components/schemas/DocumentCreateOrReplaceRequest"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Creates a new document in the persistent data storage, or replaces its content if it already exists.",
              "schema": {
                "$ref": "#/components/schemas/DocumentCreateOrReplaceResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/:_id"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/_mCreateOrReplace",
        "controller": "document",
        "action": "mCreateOrReplace",
        "url": "/:index/:collection/_mCreateOrReplace"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/:_id/_replace",
        "controller": "document",
        "action": "replace",
        "openapi": {
          "summary": "Replaces the content of an existing document.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "documentId",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "refresh",
              "schema": {
                "type": "string"
              },
              "description": " if set to wait_for, Kuzzle will not respond until the deletion has been indexed",
              "required": false
            },
            {
              "in": "path",
              "name": "silent",
              "schema": {
                "type": "boolean"
              },
              "description": "if set, then Kuzzle will not generate notifications. Available since 2.9.2",
              "required": false
            },
            {
              "name": "body",
              "in": "body",
              "description": "Replaces the content of an existing document.",
              "required": true,
              "schema": {
                "$ref": "#/components/schemas/DocumentReplaceRequest"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Replaces the content of an existing document.",
              "schema": {
                "$ref": "#/components/schemas/DocumentReplaceResponse"
              }
            }
          }
        },
        "url": "/:index/:collection/:_id/_replace"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/_mReplace",
        "controller": "document",
        "action": "mReplace",
        "url": "/:index/:collection/_mReplace"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/_mUpdate",
        "controller": "document",
        "action": "mUpdate",
        "deprecated": {
          "since": "2.11.0",
          "message": "Use \"document:mUpdate\" route with PATCH instead of PUT"
        },
        "url": "/:index/:collection/_mUpdate"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/:_id/_update",
        "controller": "document",
        "action": "update",
        "openapi": {
          "summary": "Updates a document content.",
          "tags": [
            "document"
          ],
          "parameters": [
            {
              "in": "path",
              "name": "index",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "collection",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "_id",
              "schema": {
                "type": "string"
              },
              "required": true
            },
            {
              "in": "path",
              "name": "refresh",
              "schema": {
                "type": "string"
              },
              "description": "if set to wait_for, Kuzzle will not respond until the deletion has been indexed",
              "required": false
            },
            {
              "in": "path",
              "name": "silent",
              "schema": {
                "type": "boolean"
              },
              "description": "if set, then Kuzzle will not generate notifications. Available since 2.9.2",
              "required": false
            },
            {
              "in": "path",
              "name": "source",
              "schema": {
                "type": "boolean"
              },
              "required": false,
              "description": "if set to true Kuzzle will return the entire updated document body in the response."
            },
            {
              "in": "path",
              "name": "retryOnConflict",
              "schema": {
                "type": "integer"
              },
              "description": "conflicts may occur if the same document gets updated multiple times within a short timespan, in a database cluster. You can set the retryOnConflict optional argument (with a retry count), to tell Kuzzle to retry the failing updates the specified amount of times before rejecting the request with an error.",
              "required": false
            },
            {
              "name": "body",
              "in": "body",
              "description": "Updates a document content.",
              "required": true,
              "schema": {
                "$ref": "#/components/schemas/DocumentUpdateRequest"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Updates a document content.",
              "schema": {
                "$ref": "#/components/schemas/DocumentUpdateResponse"
              }
            }
          }
        },
        "deprecated": {
          "since": "2.11.0",
          "message": "Use \"document:update\" route with PATCH instead of PUT"
        },
        "url": "/:index/:collection/:_id/_update"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/:_id/_upsert",
        "controller": "document",
        "action": "upsert",
        "deprecated": {
          "since": "2.11.0",
          "message": "Use \"document:upsert\" route with POST instead of PUT"
        },
        "url": "/:index/:collection/:_id/_upsert"
      },
      {
        "verb": "put",
        "path": "/:index/:collection/_query",
        "controller": "document",
        "action": "updateByQuery",
        "url": "/:index/:collection/_query"
      },
      {
        "verb": "put",
        "path": "/profiles/:_id",
        "controller": "security",
        "action": "createOrReplaceProfile",
        "url": "/profiles/:_id"
      },
      {
        "verb": "put",
        "path": "/roles/:_id",
        "controller": "security",
        "action": "createOrReplaceRole",
        "url": "/roles/:_id"
      },
      {
        "verb": "put",
        "path": "/credentials/:strategy/:_id/_update",
        "controller": "security",
        "action": "updateCredentials",
        "url": "/credentials/:strategy/:_id/_update"
      },
      {
        "verb": "put",
        "path": "/profiles/:_id/_update",
        "controller": "security",
        "action": "updateProfile",
        "url": "/profiles/:_id/_update"
      },
      {
        "verb": "put",
        "path": "/roles/:_id/_update",
        "controller": "security",
        "action": "updateRole",
        "url": "/roles/:_id/_update"
      },
      {
        "verb": "put",
        "path": "/users/:_id/_update",
        "controller": "security",
        "action": "updateUser",
        "url": "/users/:_id/_update"
      },
      {
        "verb": "put",
        "path": "/users/:_id/_replace",
        "controller": "security",
        "action": "replaceUser",
        "url": "/users/:_id/_replace"
      },
      {
        "verb": "put",
        "path": "/profiles/_mapping",
        "controller": "security",
        "action": "updateProfileMapping",
        "url": "/profiles/_mapping"
      },
      {
        "verb": "put",
        "path": "/roles/_mapping",
        "controller": "security",
        "action": "updateRoleMapping",
        "url": "/roles/_mapping"
      },
      {
        "verb": "put",
        "path": "/users/_mapping",
        "controller": "security",
        "action": "updateUserMapping",
        "url": "/users/_mapping"
      },
      {
        "verb": "patch",
        "path": "/:index/:collection/_mUpdate",
        "controller": "document",
        "action": "mUpdate",
        "url": "/:index/:collection/_mUpdate"
      },
      {
        "verb": "patch",
        "path": "/:index/:collection/:_id/_update",
        "controller": "document",
        "action": "update",
        "url": "/:index/:collection/:_id/_update"
      },
      {
        "verb": "patch",
        "path": "/:index/:collection/_bulk/_query",
        "controller": "bulk",
        "action": "updateByQuery",
        "url": "/:index/:collection/_bulk/_query"
      }
    ],
    "accessControlAllowOrigin": "*",
    "accessControlAllowOriginUseRegExp": false,
    "accessControlAllowMethods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
    "accessControlAllowHeaders": "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile",
    "cookieAuthentication": true
  },
  "limits": {
    "concurrentRequests": 100,
    "documentsFetchCount": 10000,
    "documentsWriteCount": 200,
    "loginsPerSecond": 1,
    "requestsBufferSize": 50000,
    "requestsBufferWarningThreshold": 5000,
    "subscriptionConditionsCount": 100,
    "subscriptionMinterms": 0,
    "subscriptionRooms": 1000000,
    "subscriptionDocumentTTL": 259200000
  },
  "application": {},
  "plugins": {
    "common": {
      "failsafeMode": false,
      "bootstrapLockTimeout": 30000,
      "pipeWarnTime": 500,
      "initTimeout": 10000,
      "maxConcurrentPipes": 50,
      "pipesBufferSize": 50000,
      "include": [
        "kuzzle-plugin-logger",
        "kuzzle-plugin-auth-passport-local"
      ]
    },
    "kuzzle-plugin-logger": {
      "services": {
        "stdout": {
          "level": "info",
          "addDate": true,
          "dateFormat": "YYYY-MM-DD HH-mm-ss"
        }
      }
    },
    "kuzzle-plugin-auth-passport-local": {
      "algorithm": "sha512",
      "stretching": true,
      "digest": "hex",
      "encryption": "hmac",
      "requirePassword": false,
      "resetPasswordExpiresIn": -1,
      "passwordPolicies": []
    }
  },
  "repositories": {
    "common": {
      "cacheTTL": 1440000
    }
  },
  "security": {
    "restrictedProfileIds": [
      "default"
    ],
    "jwt": {
      "algorithm": "HS256",
      "expiresIn": "1h",
      "gracePeriod": 1000,
      "maxTTL": -1,
      "secret": null
    },
    "authToken": {
      "algorithm": "HS256",
      "expiresIn": "1h",
      "gracePeriod": 1000,
      "maxTTL": -1,
      "secret": null
    },
    "apiKey": {
      "maxTTL": -1
    },
    "default": {
      "role": {
        "controllers": {
          "*": {
            "actions": {
              "*": true
            }
          }
        }
      }
    },
    "standard": {
      "profiles": {
        "admin": {
          "rateLimit": 0,
          "policies": [
            {
              "roleId": "admin"
            }
          ]
        },
        "default": {
          "rateLimit": 10,
          "policies": [
            {
              "roleId": "default"
            }
          ]
        },
        "anonymous": {
          "rateLimit": 200,
          "policies": [
            {
              "roleId": "anonymous"
            }
          ]
        }
      },
      "roles": {
        "admin": {
          "controllers": {
            "*": {
              "actions": {
                "*": true
              }
            }
          }
        },
        "default": {
          "controllers": {
            "auth": {
              "actions": {
                "checkToken": true,
                "getCurrentUser": true,
                "getMyRights": true,
                "logout": true,
                "updateSelf": true
              }
            },
            "server": {
              "actions": {
                "publicApi": true
              }
            }
          }
        },
        "anonymous": {
          "controllers": {
            "auth": {
              "actions": {
                "checkToken": true,
                "getCurrentUser": true,
                "getMyRights": true,
                "login": true
              }
            },
            "server": {
              "actions": {
                "publicApi": true,
                "openapi": true
              }
            }
          }
        }
      }
    }
  },
  "server": {
    "logs": {
      "transports": [
        {
          "transport": "console",
          "level": "info",
          "stderrLevels": [],
          "silent": true
        }
      ],
      "accessLogFormat": "combined",
      "accessLogIpOffset": 0
    },
    "maxRequestSize": "1MB",
    "port": 7512,
    "protocols": {
      "http": {
        "allowCompression": true,
        "enabled": true,
        "maxEncodingLayers": 3,
        "maxFormFileSize": "1MB"
      },
      "mqtt": {
        "enabled": false,
        "allowPubSub": false,
        "developmentMode": false,
        "disconnectDelay": 250,
        "requestTopic": "Kuzzle/request",
        "responseTopic": "Kuzzle/response",
        "server": {
          "port": 1883
        },
        "realtimeNotifications": true
      },
      "websocket": {
        "enabled": true,
        "idleTimeout": 60000,
        "compression": false,
        "rateLimit": 0,
        "realtimeNotifications": true
      }
    },
    "strictSdkVersion": true
  },
  "services": {
    "common": {
      "defaultInitTimeout": 120000,
      "retryInterval": 1000
    },
    "internalCache": {
      "backend": "redis",
      "clusterOptions": {
        "enableReadyCheck": true
      },
      "database": 0,
      "node": {
        "host": "localhost",
        "port": 6379
      },
      "options": {},
      "overrideDnsLookup": false
    },
    "memoryStorage": {
      "backend": "redis",
      "clusterOptions": {
        "enableReadyCheck": true
      },
      "database": 5,
      "node": {
        "host": "localhost",
        "port": 6379
      },
      "options": {},
      "overrideDnsLookup": false
    },
    "internalIndex": {
      "bootstrapLockTimeout": 60000
    },
    "storageEngine": {
      "aliases": [
        "storageEngine"
      ],
      "backend": "elasticsearch",
      "client": {
        "node": "http://localhost:9200"
      },
      "commonMapping": {
        "dynamic": "false",
        "properties": {
          "_kuzzle_info": {
            "properties": {
              "author": {
                "type": "keyword"
              },
              "createdAt": {
                "type": "date"
              },
              "updater": {
                "type": "keyword"
              },
              "updatedAt": {
                "type": "date"
              }
            }
          }
        }
      },
      "internalIndex": {
        "name": "kuzzle",
        "collections": {
          "users": {
            "dynamic": "false",
            "properties": {
              "profileIds": {
                "type": "keyword"
              }
            }
          },
          "profiles": {
            "dynamic": "false",
            "properties": {
              "tags": {
                "type": "keyword"
              },
              "policies": {
                "properties": {
                  "roleId": {
                    "type": "keyword"
                  },
                  "restrictedTo": {
                    "type": "nested",
                    "properties": {
                      "index": {
                        "type": "keyword"
                      },
                      "collections": {
                        "type": "keyword"
                      }
                    }
                  }
                }
              }
            }
          },
          "roles": {
            "dynamic": "false",
            "properties": {
              "tags": {
                "type": "keyword"
              },
              "controllers": {
                "dynamic": "false",
                "properties": {}
              }
            }
          },
          "validations": {
            "properties": {
              "index": {
                "type": "keyword"
              },
              "collection": {
                "type": "keyword"
              },
              "validations": {
                "dynamic": "false",
                "properties": {}
              }
            }
          },
          "config": {
            "dynamic": "false",
            "properties": {}
          },
          "api-keys": {
            "dynamic": "false",
            "properties": {
              "userId": {
                "type": "keyword"
              },
              "hash": {
                "type": "keyword"
              },
              "description": {
                "type": "text"
              },
              "expiresAt": {
                "type": "long"
              },
              "ttl": {
                "type": "keyword"
              },
              "token": {
                "type": "keyword"
              }
            }
          },
          "installations": {
            "dynamic": "strict",
            "properties": {
              "description": {
                "type": "text"
              },
              "handler": {
                "type": "text"
              },
              "installedAt": {
                "type": "date"
              }
            }
          }
        }
      },
      "maxScrollDuration": "1m",
      "defaults": {
        "onUpdateConflictRetries": 0,
        "scrollTTL": "15s"
      }
    }
  },
  "stats": {
    "enabled": true,
    "ttl": 3600,
    "statsInterval": 10
  },
  "cluster": {
    "activityDepth": 50,
    "heartbeat": 2000,
    "interface": null,
    "ipv6": false,
    "ip": "private",
    "joinTimeout": 60000,
    "minimumNodes": 1,
    "ports": {
      "command": 7510,
      "sync": 7511
    },
    "syncTimeout": 5000
  },
  "validation": {}
};