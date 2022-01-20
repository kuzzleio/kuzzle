import { JSONObject } from '../../../index';

import {
  RoleDefinition,
  ProfileDefinition,
} from '../index';

export type SecurityConfiguration = {
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
  jwt?: JSONObject;

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

  apiKey: {
    /**
    * Maximum duration in milliseconds a token can be requested to be valid.
    *
    * If set to -1, no maximum duration is set.
    *
    * @default -1
    */
    maxTTL: number;
  }

  /**
  * The default role defines permissions for all users,
  * until an administrator configures the backend rights.
  *
  * By default, all users are granted all permissions.
  *
  * @default
  *
  * {
  *   "role": {
  *      "controllers": {
  *        "*": {
  *          "actions": {
  *            "*": true
  *          }
  *        }
  *      }
  *    }
  *  }
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
}
