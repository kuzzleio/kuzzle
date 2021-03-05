'use strict';

/* eslint-disable sort-keys */

/**
 * /!\ DO NOT MODIFY THIS FILE
 *
 * To customize your Kuzzle installation, create a
 * ".kuzzlerc" file and put your overrides there.
 * Please check the ".kuzzlerc.sample" file to get
 * started.
 *
 * @class KuzzleConfiguration
 */
module.exports = {
  // @deprecated
  realtime: {
    pcreSupport: false
  },

  dump: {
    enabled: false,
    history: {
      coredump: 3,
      reports: 5
    },
    path: './dump/',
    gcore: 'gcore',
    dateFormat: 'YYYYMMDD-HHmmss',
    handledErrors: {
      enabled: true,
      whitelist: [
        'RangeError',
        'TypeError',
        'KuzzleError',
        'InternalError'
      ],
      minInterval: 10 * 60 * 1000
    }
  },

  /*
   routes: list of Kuzzle API exposed HTTP routes
   accessControlAllowOrigin: sets the Access-Control-Allow-Origin header used to
       send responses to the client
       (see https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS)
   */
  http: {
    routes: require('./httpRoutes'),
    accessControlAllowOrigin: '*',
    accessControlAllowMethods: 'GET,POST,PUT,DELETE,OPTIONS,HEAD',
    accessControlAllowHeaders: 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile',
  },

  limits: {
    concurrentRequests: 100,
    documentsFetchCount: 10000,
    documentsWriteCount: 200,
    loginsPerSecond: 1,
    requestsBufferSize: 50000,
    requestsBufferWarningThreshold: 5000,
    subscriptionConditionsCount: 16,
    subscriptionMinterms: 0,
    subscriptionRooms: 1000000,
    subscriptionDocumentTTL: 259200
  },

  application: {},

  plugins: {
    common: {
      bootstrapLockTimeout: 30000,
      pipeWarnTime: 500,
      initTimeout: 10000,
      maxConcurrentPipes: 50,
      pipesBufferSize: 50000,
      include: [
        'kuzzle-plugin-logger',
        'kuzzle-plugin-auth-passport-local',
      ]
    },
    'kuzzle-plugin-logger': {
      services: {
        stdout: {
          level: 'info'
        }
      }
    },
    'kuzzle-plugin-auth-passport-local': {
      algorithm: 'sha512',
      stretching: true,
      digest: 'hex',
      encryption: 'hmac',
      requirePassword: false,
      resetPasswordExpiresIn: -1,
      passwordPolicies: []
    }
  },

  repositories: {
    common: {
      cacheTTL: 1440
    }
  },

  security: {
    restrictedProfileIds: ['default'],
    jwt: {
      algorithm: 'HS256',
      expiresIn: '1h',
      gracePeriod: 1000,
      maxTTL: -1,
      secret: null
    },
    default: {
      role: {
        controllers: {
          '*': {
            actions: {
              '*': true
            }
          }
        }
      }
    },
    standard: {
      profiles: {
        admin: {
          rateLimit: 0,
          policies: [ { roleId: 'admin'} ]
        },
        default: {
          rateLimit: 10,
          policies: [ { roleId: 'default'} ]
        },
        anonymous: {
          rateLimit: 200,
          policies: [ { roleId: 'anonymous'} ]
        }
      },
      roles: {
        admin: {
          controllers: {
            '*': {
              actions: {
                '*': true
              }
            }
          }
        },
        default: {
          controllers: {
            auth: {
              actions: {
                checkToken: true,
                getCurrentUser: true,
                getMyRights: true,
                logout: true,
                updateSelf: true
              }
            },
            server: {
              actions: {
                publicApi: true
              }
            }
          }
        },
        anonymous: {
          controllers: {
            auth: {
              actions: {
                checkToken: true,
                getCurrentUser: true,
                getMyRights: true,
                login: true
              }
            },
            server: {
              actions: {
                publicApi: true,
                openapi: true
              }
            }
          }
        }
      }
    }
  },

  server: {
    logs: {
      transports: [
        {
          transport: 'console',
          level: 'info',
          stderrLevels: [],
          silent: true
        }
      ],
      accessLogFormat: 'combined',
      accessLogIpOffset: 0
    },
    maxRequestSize: '1MB',
    port: 7512,
    protocols: {
      http: {
        enabled: true,
        maxFormFileSize: '1MB',
        maxEncodingLayers: 3,
        allowCompression: true
      },
      mqtt: {
        enabled: false,
        allowPubSub: false,
        developmentMode: false,
        disconnectDelay: 250,
        requestTopic: 'Kuzzle/request',
        responseTopic: 'Kuzzle/response',
        server: {
          port: 1883
        }
      },
      websocket: {
        enabled: true,
        idleTimeout: 0,
        heartbeat: 60000
      }
    }
  },

  services: {
    common: {
      defaultInitTimeout: 120000,
      retryInterval: 1000
    },
    internalCache: {
      backend: 'redis',
      node: {
        host: 'localhost',
        port: 6379
      }
    },
    memoryStorage: {
      backend: 'redis',
      database: 5,
      node: {
        host: 'localhost',
        port: 6379
      }
    },
    internalIndex: {
      bootstrapLockTimeout: 60000
    },
    storageEngine: {
      aliases: ['storageEngine'],
      backend: 'elasticsearch',
      client: {
        node: 'http://localhost:9200'
      },
      commonMapping: {
        dynamic: 'false',
        properties: {
          _kuzzle_info: {
            properties: {
              author:     { type: 'keyword' },
              createdAt:  { type: 'date' },
              updater:    { type: 'keyword' },
              updatedAt:  { type: 'date' }
            }
          }
        }
      },
      internalIndex: {
        name: 'kuzzle',
        collections: {
          users: {
            dynamic: 'false',
            properties: {
              profileIds: { type: 'keyword' }
            }
          },
          profiles: {
            dynamic: 'false',
            properties: {
              policies: {
                properties:  {
                  roleId: { type: 'keyword' }
                }
              }
            }
          },
          roles: {
            dynamic: 'false',
            properties: {
              controllers: {
                dynamic: 'false',
                properties: {}
              }
            }
          },
          validations: {
            properties: {
              index: { type: 'keyword' },
              collection: { type: 'keyword' },
              validations: {
                dynamic: 'false',
                properties: {}
              }
            }
          },
          config: {
            dynamic: 'false',
            properties: {}
          },
          'api-keys': {
            dynamic: 'false',
            properties: {
              userId: { type: 'keyword' },
              hash: { type: 'keyword' },
              description: { type: 'text' },
              expiresAt: { type: 'long' },
              ttl: { type: 'keyword' },
              token: { type: 'keyword' }
            }
          }
        }
      },
      maxScrollDuration: '1m',
      defaults: {
        onUpdateConflictRetries: 0,
        scrollTTL: '15s'
      }
    }
  },

  stats: {
    ttl: 3600,
    statsInterval: 10
  },

  cluster: {
    activityDepth: 50,
    heartbeat: 2000,
    ipv6: false,
    joinTimeout: 60000,
    minimumNodes: 1,
    ports: {
      command: 7510,
      sync: 7511,
    },
  },

  /** @type {DocumentSpecification} */
  validation: {
  },

};
