/**
 * @class KuzzleConfiguration
 */
module.exports = {
  httpRoutes: require('./lib/config/httpRoutes'),

  plugins: {
    common: {
      workerPrefix: 'kpw:',
      pipeWarnTime: 40,
      pipeTimeout: 250
    },

    'kuzzle-plugin-logger': {
      version: '2.0.5',
      activated: true
    },
    'kuzzle-plugin-auth-passport-local': {
      version: '3.0.2',
      activated: true
    }
  },

  queues: {
    cliQueue: 'cli-queue'
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
      secret: 'Kuzzle rocks'
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
          policies: [ {roleId: 'admin', allowInternalIndex: true} ]
        },
        default: {
          policies: [ {roleId: 'default'} ]
        },
        anonymous: {
          policies: [ {roleId: 'anonymous'} ]
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
                info: true
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
                info: true
              }
            }
          }
        }
      }
    }
  },

  server: {
    maxRequestHistorySize: 50,
    maxConcurrentRequests: 50,
    maxRetainedRequests: 50000,
    warningRetainedRequestsLimit: 5000
  },

  services: {
    common: {
      defaultInitTimeout: 10000,
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
    internalBroker: {
      aliases: ['broker'],
      socket: './run/broker.sock',
      retryInterval: 1000
    },
    proxyBroker: {
      host: 'localhost',
      port: 7331,
      retryInterval: 1000
    },
    db: {
      aliases: ['storageEngine'],
      backend: 'elasticsearch',
      host: 'localhost',
      port: 9200,
      apiVersion: '5.0'
    },

    garbageCollector: {
      cleanInterval: 86400000,
      maxDelete: 1000
    }

  },

  stats: {
    ttl: 3600,
    statsInterval: 10
  },

  /** @type {DocumentSpecification} */
  validation: {
  },

  dump: {
    enabled: false,
    path: './dump/',
    dateFormat: 'YYYYMMDD-HHmm',
    handledErrors: {
      enabled: true,
      whitelist: [
        // 'Error',
        'RangeError',
        'TypeError',
        'KuzzleError',
        'InternalError',
        'PluginImplementationError'
      ]
    }
  }
};
