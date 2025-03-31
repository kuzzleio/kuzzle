import { JSONObject } from "../../../index";

import { PasswordPolicy } from "../index";

export type PluginsConfiguration = {
  /**
   * Common configuration for all plugins.
   */
  common: {
    /**
     * If true, Kuzzle will not load custom plugin and features (including
     * the ones defined in the application).
     * The API will only be available to administrators ("admin" profile)
     * during failsafe mode.
     *
     * @default false
     */
    failsafeMode: boolean;

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
     * @default ["kuzzle-plugin-auth-passport-local"]
     */
    include: string[];

    /**
     * Warning time threshold on a pipe plugin action (in milliseconds).
     *
     * @default 500
     */
    pipeWarnTime: number;

    /**
     * Maximum execution time of a plugin init method (in milliseconds).
     *
     * @default 10000
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
  };

  /**
   * Logger plugin configuration.
   * @deprecated use server.logs
   */
  "kuzzle-plugin-logger"?: {
    /**
     * Services declaration
     */
    services: {
      /**
       * Print logs to STDOUT
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
      };

      [transport: string]: JSONObject;
    };
  };

  /**
   * Default local auth strategy plugin.
   *
   * @see https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local/
   */
  "kuzzle-plugin-auth-passport-local": {
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
    requirePassword: boolean;

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
  };

  [pluginName: string]: JSONObject;
};
