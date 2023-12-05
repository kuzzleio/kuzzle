/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

const Bluebird = require("bluebird");

const Redis = require("../../service/cache/redis");

class CacheEngine {
  constructor() {
    const config = global.kuzzle.config.services;

    this.public = new Redis(config.memoryStorage, "public_adapter");
    this.internal = new Redis(config.internalCache, "internal_adapter");
  }

  /**
   * Initializes the redis clients
   *
   * @returns {Promise}
   */
  async init() {
    await Bluebird.all([this.public.init(), this.internal.init()]);

    this.registerInternalEvents();
    this.registerPublicEvents();

    global.kuzzle.log.info("[✔] Cache initialized");
  }

  registerInternalEvents() {
    /**
     * Deletes on or multiple keys
     * @param  {string|Array.<string>} keys
     */
    global.kuzzle.onAsk("core:cache:internal:del", (keys) =>
      this.internal.commands.del(keys),
    );

    /**
     * Asks a key to expire in the provided delay
     * @param {string} key
     * @param {number} ttl (in seconds)
     */
    global.kuzzle.onAsk("core:cache:internal:expire", (key, ttl) =>
      this.internal.commands.expire(key, ttl),
    );

    /**
     * Wipes the database clean
     */
    global.kuzzle.onAsk("core:cache:internal:flushdb", () =>
      this.internal.commands.flushdb(),
    );

    /**
     * Returns basic information about the internal cache service
     * @returns {Promise.<Object>}
     */
    global.kuzzle.onAsk("core:cache:internal:info:get", () =>
      this.internal.info(),
    );

    /**
     * Fetches a single value
     * @param {string} key
     * @return {string}
     */
    global.kuzzle.onAsk("core:cache:internal:get", (key) =>
      this.internal.commands.get(key),
    );

    /**
     * Fetches multiple values in one go
     * @param  {Array.<string>} ids
     * @return {Array.<string|null>}
     */
    global.kuzzle.onAsk("core:cache:internal:mget", (keys) => {
      // redis throws an error if trying to mget without arguments
      if (keys.length === 0) {
        return [];
      }

      return this.internal.commands.mget(keys);
    });

    /**
     * Makes a key persistent (disable its expiration delay, if there is one)
     * @param {string} key
     */
    global.kuzzle.onAsk("core:cache:internal:persist", (key) =>
      this.internal.commands.persist(key),
    );

    /**
     * Asks a key to expire in the provided delay
     * @param {string} key
     * @param {number} ttl (in milliseconds)
     */
    global.kuzzle.onAsk("core:cache:internal:pexpire", (key, ttl) =>
      this.internal.commands.pexpire(key, ttl),
    );

    /**
     * Fetches all keys matching the provided pattern
     * @param {string} pattern
     */
    global.kuzzle.onAsk("core:cache:internal:searchKeys", (pattern) =>
      this.internal.searchKeys(pattern),
    );

    /**
     * Add a custom LUA script to the internal client
     * The script can then be executed using core:cache:internal:script:execute
     * @see {@link https://www.npmjs.com/package/ioredis#lua-scripting}
     *
     * @param {string} name of the script
     * @param {number} keys -- number of keys
     * @param {string} script
     */
    global.kuzzle.onAsk(
      "core:cache:internal:script:define",
      (name, keys, script) => {
        return this.internal.client.defineCommand(name, {
          lua: script,
          numberOfKeys: keys,
        });
      },
    );

    /**
     * Execute a script previously defined with core:cache:internal:script:define
     *
     * @param {string} name of the script to execute
     * @param {...string} args -- script arguments
     * @return {*} script result (if any)
     */
    global.kuzzle.onAsk("core:cache:internal:script:execute", (name, ...args) =>
      this.internal.client[name](...args),
    );

    /**
     * Convenience method for easy access to options NX and PX of the "set"
     * command.
     * Deliberately not named after an existing Redis command to prevent
     * confusion with Redis' API.
     *
     * Options:
     *   - ttl: key expiration TTL in milliseconds
     *   - onlyIfNew: if true, does not write the key if it already exists
     *
     * @param {string} key
     * @param {string} value
     * @param {{ttl: number, onlyIfNew: boolean}} [opts]
     * @returns {Promise.<boolean>} true if the key was set, false otherwise
     */
    global.kuzzle.onAsk("core:cache:internal:store", (key, value, opts) =>
      this.internal.store(key, value, opts),
    );

    /**
     * Executes an arbitrary NATIVE cache command directly
     * @param {string} command
     * @param {Array} args -- command arguments
     */
    global.kuzzle.onAsk("core:cache:internal:execute", (command, ...args) =>
      this.internal.exec(command, ...args),
    );
  }

  registerPublicEvents() {
    /**
     * Deletes on or multiple keys
     * @param  {string|Array.<string>} keys
     */
    global.kuzzle.onAsk("core:cache:public:del", (keys) =>
      this.public.commands.del(keys),
    );

    /**
     * Executes an arbitrary NATIVE cache command directly
     * @param {string} command
     * @param {Array} args -- command arguments
     */
    global.kuzzle.onAsk("core:cache:public:execute", (command, ...args) =>
      this.public.exec(command, ...args),
    );

    /**
     * Asks a key to expire in the provided delay
     * @param {string} key
     * @param {number} ttl (in seconds)
     */
    global.kuzzle.onAsk("core:cache:public:expire", (key, ttl) =>
      this.public.commands.expire(key, ttl),
    );

    /**
     * Wipes the database clean
     */
    global.kuzzle.onAsk("core:cache:public:flushdb", () =>
      this.public.commands.flushdb(),
    );

    /**
     * Returns basic information about the internal cache service
     * @returns {Promise.<Object>}
     */
    global.kuzzle.onAsk("core:cache:public:info:get", () => this.public.info());

    /**
     * Fetches a single value
     * @param {string} key
     * @return {string}
     */
    global.kuzzle.onAsk("core:cache:public:get", (key) =>
      this.public.commands.get(key),
    );

    /**
     * Executes multiple cache commands in one go, as a single transaction
     * @param {Array} commands to execute
     */
    global.kuzzle.onAsk("core:cache:public:mExecute", (commands) =>
      this.public.mExecute(commands),
    );

    /**
     * Makes a key persistent (disable its expiration delay, if there is one)
     * @param {string} key
     */
    global.kuzzle.onAsk("core:cache:public:persist", (key) =>
      this.public.commands.persist(key),
    );

    /**
     * Convenience method for easy access to options NX and PX of the "set"
     * command.
     * Deliberately not named after an existing Redis command to prevent
     * confusion with Redis' API.
     *
     * Options:
     *   - ttl: key expiration TTL in milliseconds
     *   - onlyIfNew: if true, does not write the key if it already exists
     *
     * @param {string} key
     * @param {string} value
     * @param {{ttl: number, onlyIfNew: boolean}} [opts]
     * @returns {Promise.<boolean>} true if the key was set, false otherwise
     */
    global.kuzzle.onAsk("core:cache:public:store", (key, value, opts) =>
      this.public.store(key, value, opts),
    );
  }
}

module.exports = CacheEngine;
