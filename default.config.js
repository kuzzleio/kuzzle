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
    routes: require('./lib/config/httpRoutes'),
    accessControlAllowOrigin: '*',
    accessControlAllowMethods: 'GET,POST,PUT,DELETE,OPTIONS,HEAD',
    accessControlAllowHeaders: 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile'
  },

  limits: {
    concurrentRequests: 100,
    documentsFetchCount: 10000,
    documentsWriteCount: 200,
    requestsBufferSize: 50000,
    requestsBufferWarningThreshold: 5000,
    subscriptionConditionsCount: 16,
    subscriptionMinterms: 0,
    subscriptionRooms: 1000000,
    subscriptionDocumentTTL: 259200
  },

  plugins: {
    common: {
      bootstrapLockTimeout: 5000,
      pipeWarnTime: 500,
      pipeTimeout: 5000,
      initTimeout: 10000,
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
      gracePeriod: 1000,
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
      socketio: {
        enabled: true,
        origins: '*:*'
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
    internalEngine: {
      bootstrapLockTimeout: 5000
    },
    db: {
      aliases: ['storageEngine'],
      backend: 'elasticsearch',
      client: {
        host: 'http://localhost:9200',
        apiVersion: '5.6'
      },
      commonMapping: {
        _kuzzle_info: {
          properties: {
            active: {type: 'boolean'},
            author: {type: 'keyword'},
            createdAt: {type: 'date'},
            updatedAt: {type: 'date'},
            updater: {type: 'keyword'},
            deletedAt: {type: 'date'}
          }
        }
      },
      defaults: {
        onUpdateConflictRetries: 0,
        scrollTTL: '15s'
      },
      dynamic: 'true'
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
