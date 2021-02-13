import { JSONObject } from '../../index';
import {
  PasswordPolicy,
  RoleDefinition,
  ProfileDefinition
} from './index';

export interface IKuzzleConfiguration {
  /**
   * The HTTP section lets you configure how Kuzzle should
   * handle HTTP requests.
   */
  http: {
    /**
     * Sets the default Access-Control-Allow-Origin HTTP
     * header used to send responses to the client.
     *
     * @default "*"
     */
    accessControlAllowOrigin: string;

    /**
     * Sets the default Access-Control-Allow-Method header.
     *
     * @default "GET,POST,PUT,DELETE,OPTIONS,HEAD"
     */
    accessControlAllowMethods: string;

    /**
     * Sets the default Access-Control-Allow-Headers.
     *
     * @default "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile"
     */
    accessControlAllowHeaders: string;
  },

  /**
   * Kuzzle configured limits.
   */
  limits: {
    /**
     * Number of requests Kuzzle processes simultaneously.
     *
     * Requests received above this limit are buffered until a slot is freed
     *
     * This value should be kept low to avoid overloading Kuzzle's event loop.
     *
     * @default 50
     */
    concurrentRequests: number;

    /**
     * Maximum number of documents that can be fetched by a single API
     * request. The minimum value to this limit is 1.
     *
     * This limits is applied to any route returning multiple documents,
     * such as document:mGet or document:search
     *
     * You may have to configure ElasticSearch as well if you need
     * to set this value higher than 10000
     *
     * @default 10000
     */
    documentsFetchCount: number;

    /**
     * Maximum number of documents that can be written by a single API
     * request. The minimum value to this limit is 1.
     *
     * There is no higher limit to this value, but you may
     * also have to change the value of the `maxRequestSize` parameter
     * (in the `server` section) to make Kuzzle accept larger requests.
     *
     * @default 200
     */
    documentsWriteCount: number;

    /**
     * Maximum number of logins per second and per network connection.
     *
     * @default 1
     */
    loginsPerSecond: number;

    /**
     * Maximum number of requests that can be buffered.
     *
     * Requests received above this limit are discarded with a 503 error
     *
     * @default 50000
     */
    requestsBufferSize: number;

    /**
     * Number of buffered requests after which Kuzzle
     * will throw `core:overload` events.
     *
     * @see https://docs.kuzzle.io/core/2/framework/events/core/#core-overload
     *
     * @default 5000
     *
     */
    requestsBufferWarningThreshold: number;

    /**
     * Maximum number of conditions a subscription filter can contain.
     *
     * NB: A condition is either a "simple" operator (anything but "and",
     *     "or" and "bool"), or a boolean condition that contains only
     *     simple operators.
     *
     * @default 16
     */
    subscriptionConditionsCount: number;

    /**
     * Maximum number of minterms (AND) clauses after the filters are
     * transformed in their Canonical Disjunctive Normal Form (CDNF).
     *
     * Set to 0 for no limit.
     *
     * @default 0
     */
    subscriptionMinterms: number;

    /**
      * Maximum number of different subscription rooms.
      * (i.e. different index+collection+filters subscription configurations)
      *
      * Depends primarily on available memory.
      *
      * If set to 0, an unlimited number of rooms can be created.
      *
      * @default 1000000
     */
    subscriptionRooms: number

    /**
     * Maximum time (in seconds) a document will be kept in cache for
     * real-time subscriptions.
     *
     * This cache is used to notify subscriber when a document enters or
     * leaves a scope after an update.
     *
     * By default, subscriptions will be kept 72 hours.
     *
     * Please note that keeping subscriptions over a long period of
     * time may result in memory overuse.
     *
     * If set to 0, the subscription will be kept in cache forever.
     *
     * Setting the property to 0 will lead to a memory leak if
     * documents enter a real-time subscription scope and never exit
     * that scope.
     *
     * @default 259200 (72 * 60 * 60)
     */
    subscriptionDocumentTTL: number;
  },

  /**
   * The application section lets you configure your application.
   */
  application: JSONObject;

  /**
   * The plugins section lets you define plugins behaviors.
   *
   * @see https://docs.kuzzle.io/core/2/guides/write-plugins
   */
  plugins: {

    /**
     * Common configuration for all plugins.
     */
    common: {
      /**
       * Maximum amount of time (in milliseconds) to wait
       * for a concurrent plugin bootstrap.
       *
       * @default 30000
       */
      bootstrapLockTimeout: number;

      /**
       * List of Kuzzle's embedded plugins to be activated.
       *
       * Edit this list to deactivate one or more of those plugins.
       * NOTE: this list does not control plugins installed manually.
       *
       * @default ["kuzzle-plugin-logger","kuzzle-plugin-auth-passport-local"]
       */
      include: string[];

      /**
       * Warning time threshold on a pipe plugin action (in milliseconds).
       *
       * @default 40
       */
      pipeWarnTime: number;

      /**
       * Maximum execution time of a plugin init method (in milliseconds).
       *
       * @default 2000
       */
      initTimeout: number;

      /**
       * Maximum number of pipes that can be executed in parallel.
       *
       * New pipes submitted while the maximum number of pipes is met are
       * delayed for later execution.
       *
       * This parameter controls is used to limit the stress put on the
       * event loop, allowing for Kuzzle to process pipes faster, and to
       * protect it from performances degradation if an abnormal number of
       * pipes are submitted.
       *
       * (timers do not start while a pipe is hold back)
       *
       * @default 50
       */
      maxConcurrentPipes: number;

      /**
       * Maximum number of pipes that can be delayed. If full, new pipes
       * are rejected.
       *
       * @default 50000
       */
      pipesBufferSize: number;
    },

    /**
     * Default logger plugin configuration.
     *
     * This plugin use Winston to transport the logs.
     *
     * @see https://github.com/kuzzleio/kuzzle-plugin-logger
     */
    'kuzzle-plugin-logger': {
      /**
       * Winston transport services declaration
       */
      services: {
        /**
         * Print logs to STDOUT
         *
         * @default
         *
         * @see https://github.com/winstonjs/winston/blob/master/docs/transports.md#console-transport
         */
        stdout: {
          /**
           * Level of messages that transport should log
           *
           * @default "info"
           */
          level: string;

          /**
           * Add the date to log lines
           *
           * @default true
           */
          addDate: boolean;

          /**
           * Date format
           *
           * @default "YYYY-MM-DD HH-mm-ss"
           */
          dateFormat: string;
        },

        [transport: string]: JSONObject;
      }
    },

    /**
     * Default local auth strategy plugin.
     *
     * @see https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local/
     */
    'kuzzle-plugin-auth-passport-local': {
      /**
       * One of the supported encryption algorithms
       * (run crypto.getHashes() to get the complete list).
       *
       * Examples: sha256, sha512, blake2b512, whirlpool, ...
       *
       * @default "sha512"
       */
      algorithm: string;

      /**
       * Boolean and controlling if the password is stretched or not.
       *
       * @default true
       */
      stretching: boolean;

      /**
       * Describes how the hashed password is stored in the database
       *
       * @see https://nodejs.org/api/buffer.html#buffer_buf_tostring_encoding_start_end
       *
       * @default "hex"
       */
      digest: string;

      /**
       * Determines whether the hashing algorithm uses crypto.createHash (hash)
       * or crypto.createHmac (hmac).
       *
       * @see https://nodejs.org/api/crypto.html
       *
       * @default "hmac"
       */
      encryption: string;

      /**
       * If true, Kuzzle will refuse any credentials update or deletion,
       * unless the currently valid password is provided
       * or if the change is performed via the security controller.
       *
       * @default false
       */
      requirePassword: false;

      /**
       * A positive time representation of the delay after which a
       * reset password token expires.
       *
       * @see https://www.npmjs.com/package/ms
       *
       * Users with expired passwords are given a resetPasswordToken when
       * logging in and must change their password to be allowed to log in again.
       *
       * @default -1
       */
      resetPasswordExpiresIn: number;

      /**
       * Set of additional rules to apply to users, or to groups of users.
       *
       * @see https://docs.kuzzle.io/core/2/guides/main-concepts/authentication#password-policies
       */
      passwordPolicies: PasswordPolicy[];
    },

    [pluginName: string]: JSONObject;
  },

  /**
   * The repositories are used internally by Kuzzle to store its data (users,
   * permissions, configuration etc.)
   */
  repositories: {

    /**
     * Time to live (in seconds) of cached objects.
     *
     * Decreasing this value will lower Redis memory and disk consumption,
     * at the cost of increasing queries rate to the database and response times.
     *
     * @default 1440
     */
    cacheTTL: number;
  },

  /**
   * The security section contains the configuration for Kuzzle permissions
   * system.
   *
   */
  security: {

    /**
     * The profileIds applied to a user created with the API action
     * `security:createRestrictedUser`.
     *
     * @default ["default"]
     */
    restrictedProfileIds: string[];

    /**
     * @deprecated Use `security.authToken` instead.
     */
    jwt: JSONObject;

    /**
     * Configuration for the npm package jsonwebtoken
     * who handle Kuzzle Authentication Token.
     *
     * @see https://github.com/auth0/node-jsonwebtoken
     */
    authToken: {

      /**
       * Hash/encryption method used to sign the token.
       *
       * @default "HS256"
       */
      algorithm: string;

      /**
       * Token default expiration time.
       *
       * @see https://www.npmjs.com/package/ms
       *
       * @default "1h"
       */
      expiresIn: string;

      /**
       * Duration in ms during which a renewed token is still considered valid.
       *
       * @default 1000
       */
      gracePeriod: number;

      /**
       * Maximum duration in milliseconds a token can be requested to be valid.
       *
       * If set to -1, no maximum duration is set.
       *
       * @default -1
       */
      maxTTL: number;

      /**
       * String or buffer data containing either the secret for HMAC
       * algorithms, or the PEM encoded private key for RSA and ECDSA.
       *
       * If left to null, Kuzzle will autogenerate a random
       * seed (can only be used with HMAC algorithms).
       *
       * @default null
       */
      secret: string | Buffer;
    },

    /**
     * The default role defines permissions for all users,
     * until an administrator configures the backend rights.
     *
     * By default, all users are granted all permissions.
     *
     * @default
     *
     * {
          "role": {
            "controllers": {
              "*": {
                "actions": {
                  "*": true
                }
              }
            }
          }
        }
     */
    default: {
      role: RoleDefinition
    },

    /**
     * Permissions used when creating an administrator user.
     *
     * By default, the admin user is granted all permissions.
     *
     * Anonymous and non-administrator users have their rights restricted.
     *
     * @default
     *
     * {
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
          },
          "profiles": {
            "admin": {
              "rateLimit": 0,
              "policies": [ {"roleId": "admin"} ]
            },
            "default": {
              "rateLimit": 10,
              "policies": [ {"roleId": "default"} ]
            },
            "anonymous": {
              "rateLimit": 200,
              "policies": [ {"roleId": "anonymous"} ]
            }
          }
        }
     */
    standard: {
      roles: {
        admin: RoleDefinition;
        default: RoleDefinition;
        anonymous: RoleDefinition;
        [roleName: string]: RoleDefinition;
      },
      profiles: {
        admin: ProfileDefinition;
        default: ProfileDefinition;
        anonymous: ProfileDefinition;
        [profileName: string]: ProfileDefinition;
      }
    }
  },

  /**
   * Kuzzle server is the entry point for incoming requests.
   */
  server: {
    /**
     * The maximum size of an incoming request.
     *
     * Units can be expressed in bytes ("b" or none), kilobytes ("kb"),
     * megabytes ("mb"), gigabytes ("gb") or terabytes ("tb").
     *
     * @default "1mb"
     */
    maxRequestSize: string;

    /**
     * The listening port for HTTP and WebSocket protocols.
     *
     * @default 7512
     */
    port: number;

    /**
     * Configuration section for Kuzzle access logs.
     */
    logs: {
      /**
       * An array of Winston transports configurations to output access
       * logs.
       *
       * Possible transport types are: console, file, elasticsearch and syslog.
       *
       * Please refer to https://github.com/winstonjs/winston/blob/master/docs/transports.md
       * for more information on transports configuration.
       *
       * @default
       *
       * [
          {
            transport: 'console',
            level: 'info',
            stderrLevels: [],
            silent: true
          }
        ]
       *
       */
      transports: JSONObject[];

      /**
       * Access log format.
       *
       * Currently supported are "combined" (=Apache combined logs format)
       * and "logstash".
       *
       * "logstash" will output the whole request input to JSON, ready to
       * be consumed by logstash agent.
       *
       * @default "combined"
       */
      accessLogFormat: string;

      /**
       * The offset to use as the client ip, from the FORWARDED-FOR chain,
       * beginning from the right (0 = the ip address of the last
       * client|proxy which connected to Kuzzle.
       *
       * @default 0
       */
      accessLogIpOffset: number
    },

    protocols: {}
  },
}

export type KuzzleConfiguration = Partial<IKuzzleConfiguration>
