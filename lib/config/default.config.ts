import httpRoutes from "../api/httpRoutes.js";
import { KuzzleConfiguration } from "../types/config/KuzzleConfiguration";

/* eslint-disable sort-keys */

/**
 * /!\ DO NOT MODIFY THIS FILE
 *
 * To customize your Kuzzle installation, create a
 * ".kuzzlerc" file and put your overrides there.
 * Please check the ".kuzzlerc.sample.jsonc" file to get
 * started.
 *
 * @class KuzzleConfiguration
 */

const defaultConfig: KuzzleConfiguration = {
  // @deprecated
  realtime: {
    pcreSupport: false,
  },

  dump: {
    enabled: false,
    history: {
      coredump: 3,
      reports: 5,
    },
    path: "./dump/",
    gcore: "gcore",
    dateFormat: "YYYYMMDD-HHmmss",
    handledErrors: {
      enabled: true,
      whitelist: ["RangeError", "TypeError", "KuzzleError", "InternalError"],
      minInterval: 10 * 60 * 1000,
    },
  },

  /*
   routes: list of Kuzzle API exposed HTTP routes
   accessControlAllowOrigin: sets the Access-Control-Allow-Origin header used to
       send responses to the client
       (see https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS)
   */
  http: {
    routes: httpRoutes,
    accessControlAllowOrigin: "*",
    accessControlAllowOriginUseRegExp: false,
    accessControlAllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
    accessControlAllowHeaders:
      "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile",
    cookieAuthentication: true,
  },

  limits: {
    concurrentRequests: 100,
    documentsFetchCount: 10000,
    documentsWriteCount: 200,
    loginsPerSecond: 1,
    requestsBufferSize: 50000,
    requestsBufferWarningThreshold: 5000,
    subscriptionConditionsCount: 100,
    subscriptionMinterms: 0,
    subscriptionRooms: 1000000,
    subscriptionDocumentTTL: 259200000,
  },

  application: {},

  plugins: {
    common: {
      failsafeMode: false,
      bootstrapLockTimeout: 30000,
      pipeWarnTime: 500,
      initTimeout: 10000,
      maxConcurrentPipes: 50,
      pipesBufferSize: 50000,
      include: ["kuzzle-plugin-auth-passport-local"],
    },
    "kuzzle-plugin-auth-passport-local": {
      algorithm: "sha512",
      stretching: true,
      digest: "hex",
      encryption: "hmac",
      requirePassword: false,
      resetPasswordExpiresIn: -1,
      passwordPolicies: [],
    },
  },

  repositories: {
    common: {
      cacheTTL: 1440000,
    },
  },

  security: {
    debug: {
      native_debug_protocol: false,
    },
    restrictedProfileIds: ["default"],
    jwt: {
      algorithm: "HS256",
      expiresIn: "1h",
      gracePeriod: 1000,
      maxTTL: -1,
      secret: null,
    },
    authToken: {
      algorithm: "HS256",
      expiresIn: "1h",
      gracePeriod: 1000,
      maxTTL: -1,
      secret: null,
    },
    apiKey: {
      maxTTL: -1,
    },
    default: {
      role: {
        controllers: {
          "*": {
            actions: {
              "*": true,
            },
          },
        },
      },
    },
    standard: {
      profiles: {
        admin: {
          rateLimit: 0,
          policies: [{ roleId: "admin" }],
        },
        default: {
          rateLimit: 10,
          policies: [{ roleId: "default" }],
        },
        anonymous: {
          rateLimit: 200,
          policies: [{ roleId: "anonymous" }],
        },
      },
      roles: {
        admin: {
          controllers: {
            "*": {
              actions: {
                "*": true,
              },
            },
          },
        },
        default: {
          controllers: {
            auth: {
              actions: {
                checkToken: true,
                getCurrentUser: true,
                getMyRights: true,
                logout: true,
                updateSelf: true,
              },
            },
            server: {
              actions: {
                publicApi: true,
              },
            },
          },
        },
        anonymous: {
          controllers: {
            auth: {
              actions: {
                checkToken: true,
                getCurrentUser: true,
                getMyRights: true,
                login: true,
              },
            },
            server: {
              actions: {
                publicApi: true,
                openapi: true,
              },
            },
          },
        },
      },
    },
  },

  server: {
    appLogs: {
      level: "info",
      transport: {
        targets: [
          {
            preset: "stdout",
          },
        ],
      },
    },
    logs: {
      transports: [
        {
          preset: "console",
          level: "info",
          stderrLevels: [],
          silent: true,
        },
      ],
      accessLogFormat: "combined",
      accessLogIpOffset: 0,
    },
    maxRequestSize: "1MB",
    port: 7512,
    protocols: {
      http: {
        additionalContentTypes: [],
        allowCompression: true,
        enabled: true,
        maxEncodingLayers: 3,
        maxFormFileSize: "1MB",
      },
      mqtt: {
        enabled: false,
        allowPubSub: false,
        developmentMode: false,
        disconnectDelay: 250,
        requestTopic: "Kuzzle/request",
        responseTopic: "Kuzzle/response",
        server: {
          port: 1883,
        },
        realtimeNotifications: true,
      },
      websocket: {
        enabled: true,
        idleTimeout: 60000,
        compression: false,
        rateLimit: 0,
        realtimeNotifications: true,
        resetIdleTimeoutOnSend: false,
        sendPingsAutomatically: false,
      },
    },
    strictSdkVersion: true,
  },

  services: {
    common: {
      defaultInitTimeout: 120000,
      retryInterval: 1000,
    },
    internalCache: {
      backend: "redis",
      clusterOptions: {
        enableReadyCheck: true,
      },
      database: 0,
      node: {
        host: "localhost",
        port: 6379,
      },
      options: {},
      overrideDnsLookup: false,
    },
    memoryStorage: {
      backend: "redis",
      clusterOptions: {
        enableReadyCheck: true,
      },
      database: 5,
      node: {
        host: "localhost",
        port: 6379,
      },
      options: {},
      overrideDnsLookup: false,
    },
    internalIndex: {
      bootstrapLockTimeout: 60000,
    },
    storageEngine: {
      majorVersion: "7",
      aliases: ["storageEngine"],
      backend: "elasticsearch",
      client: {
        node: "http://localhost:9200",
      },
      commonMapping: {
        dynamic: "false",
        properties: {
          _kuzzle_info: {
            properties: {
              author: { type: "keyword" },
              createdAt: { type: "date" },
              updater: { type: "keyword" },
              updatedAt: { type: "date" },
            },
          },
        },
      },
      defaultSettings: {
        number_of_replicas: 1,
        number_of_shards: 1,
      },
      internalIndex: {
        name: "kuzzle",
        collections: {
          users: {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: undefined,
              number_of_replicas: undefined,
            },
            mappings: {
              dynamic: "false",
              properties: {
                profileIds: { type: "keyword" },
              },
            },
          },
          profiles: {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: undefined,
              number_of_replicas: undefined,
            },
            mappings: {
              dynamic: "false",
              properties: {
                tags: { type: "keyword" },
                policies: {
                  properties: {
                    roleId: { type: "keyword" },
                    restrictedTo: {
                      type: "nested",
                      properties: {
                        index: { type: "keyword" },
                        collections: { type: "keyword" },
                      },
                    },
                  },
                },
              },
            },
          },
          roles: {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: undefined,
              number_of_replicas: undefined,
            },
            mappings: {
              dynamic: "false",
              properties: {
                tags: { type: "keyword" },
                controllers: {
                  dynamic: "false",
                  properties: {},
                },
              },
            },
          },
          validations: {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: undefined,
              number_of_replicas: undefined,
            },
            mappings: {
              properties: {
                index: { type: "keyword" },
                collection: { type: "keyword" },
                validations: {
                  dynamic: "false",
                  properties: {},
                },
              },
            },
          },
          config: {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: undefined,
              number_of_replicas: undefined,
            },
            mappings: {
              dynamic: "false",
              properties: {},
            },
          },
          "api-keys": {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: undefined,
              number_of_replicas: undefined,
            },
            mappings: {
              dynamic: "false",
              properties: {
                userId: { type: "keyword" },
                hash: { type: "keyword" },
                description: { type: "text" },
                expiresAt: { type: "long" },
                ttl: { type: "keyword" },
                token: { type: "keyword" },
              },
            },
          },
          installations: {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: undefined,
              number_of_replicas: undefined,
            },
            mappings: {
              dynamic: "strict",
              properties: {
                description: { type: "text" },
                handler: { type: "text" },
                installedAt: { type: "date" },
              },
            },
          },
          imports: {
            settings: {
              // @deprecated : replace undefined by 1
              number_of_shards: 1,
              number_of_replicas: 1,
            },
            mappings: {
              dynamic: "strict",
              properties: {
                hash: { type: "keyword" },
              },
            },
          },
        },
      },
      maxScrollDuration: "1m",
      defaults: {
        onUpdateConflictRetries: 0,
        scrollTTL: "15s",
      },
      generateMissingAliases: true,
    },
  },

  stats: {
    enabled: true,
    ttl: 3600,
    statsInterval: 10,
  },

  cluster: {
    enabled: true,
    activityDepth: 50,
    heartbeat: 2000,
    interface: null,
    ipv6: false,
    ip: "private",
    joinTimeout: 60000,
    minimumNodes: 1,
    ports: {
      command: 7510,
      sync: 7511,
    },
    syncTimeout: 5000,
  },
  /** @type {DocumentSpecification} */
  validation: {},

  controllers: {
    definition: {
      allowAdditionalActionProperties: false,
    },
  },
};

export default defaultConfig;
