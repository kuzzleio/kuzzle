import { JSONObject } from '../../../index';
import {
  RoleDefinition,
  ProfileDefinition,
  PluginsConfiguration,
  LimitsConfiguration,
  HttpConfiguration
} from '../index';


export interface IKuzzleConfiguration {
  /**
   * The HTTP section lets you configure how Kuzzle should
   * handle HTTP requests.
   */
  http: HttpConfiguration

  /**
   * Kuzzle configured limits.
   */
  limits: LimitsConfiguration
  /**
   * The application section lets you configure your application.
   */
  application: Record<string, unknown>,

  /**
   * The plugins section lets you define plugins behaviors.
   *
   * @see https://docs.kuzzle.io/core/2/guides/write-plugins
   */
  plugins: PluginsConfiguration

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

    protocols: Record<string, unknown>,
  },
}

export type KuzzleConfiguration = Partial<IKuzzleConfiguration>
