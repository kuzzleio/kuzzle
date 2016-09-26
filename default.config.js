module.exports = {
  hooks: require('./lib/config/hooks'),

  httpRoutes: require('./lib/config/httpRoutes'),

  plugins: {
    common: {
      pipeWarnTime: 40,
      pipeTimeout: 250
    },

    'kuzzle-plugin-logger': {
      npmVersion: '2.0.4',
      activated: true
    },
    'kuzzle-plugin-auth-passport-local': {
      npmVersion: '2.0.4',
      activated: true
    }
  },

  queues: {
    remoteActionsQueue: 'remote-actions-queue'
  },

  repositories: {
    common: {
      cacheTTL: 1440
    }
  },

  security: {
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
                login: true,
                logout: true,
                updateSelf: true
              }
            },
            read: {
              actions: {
                serverInfo: true
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
                login: true,
                logout: true
              }
            },
            read: {
              actions: {
                serverInfo: true
              }
            }
          }
        }
      }
    }
  },

  server: {
    http: {
      port: 7511,
      maxRequestSize: '1MB'
    },
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
        host: 'redis',
        port: 6379
      }
    },
    memoryStorage: {
      backend: 'redis',
      database: 5,
      node: {
        host: 'redis',
        port: 6379
      }
    },
    internalBroker: {
      aliases: ['broker'],
      host: 'localhost',
      port: 7911,
      retryInterval: 1000
    },
    proxyBroker: {
      host: 'api',
      port: 7331,
      retryInterval: 1000
    },
    db: {
      aliases: ['storageEngine'],
      backend: 'elasticsearch',
      host: 'elasticsearch',
      port: 9200,
      apiVersion: '2.3'
    }

  },

  stats: {
    ttl: 3600,
    statsInterval: 10
  }

};
