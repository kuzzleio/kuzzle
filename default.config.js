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
  dump: {
    enabled: true,
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
    routes: require('./lib/config/httpRoutes'),
    accessControlAllowOrigin: '*'
  },

  limits: {
    concurrentRequests: 50,
    documentsFetchCount: 1000,
    documentsWriteCount: 200,
    requestsHistorySize: 50,
    requestsBufferSize: 50000,
    requestsBufferWarningThreshold: 5000,
    subscriptionConditionsCount: 16,
    subscriptionRooms: 1000000
  },

  plugins: {
    common: {
      workerPrefix: 'kpw:',
      pipeWarnTime: 40,
      pipeTimeout: 250,
      initTimeout: 10000,
    },
    'kuzzle-plugin-logger': {
      threads: 1
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
          policies: [ {roleId: 'admin'} ]
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
    entryPoints: {
      embedded: true,
      proxy: false
    },
    proxy: {
      host: 'localhost',
      port: 7331,
      retryInterval: 1000,
      resendClientListDelay: 1000
    },
    logs: {
      transports: [
        {
          transport: 'console',
          level: 'info',
          stderrLevels: []
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
        maxFormFileSize: '1MB'
      },
      socketio: {
        enabled: true,
        origins: '*:*'
      },
      websocket: {
        enabled: true
      }
    }
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
    db: {
      aliases: ['storageEngine'],
      backend: 'elasticsearch',
      client: {
        host: 'http://localhost:9200',
        apiVersion: '5.x'
      },
      defaults: {
        onUpdateConflictRetries: 0,
        scrollTTL: '15s'
      }
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
  }

};
