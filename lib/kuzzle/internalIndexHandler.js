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

const crypto = require("crypto");

const Bluebird = require("bluebird");

const debug = require("../util/debug")("kuzzle:bootstrap:internalIndex");
const { Store } = require("../core/shared/store");
const { Mutex } = require("../util/mutex");
const { storeScopeEnum } = require("../core/storage/storeScopeEnum");
const kerror = require("../kerror");

const securitiesBootstrap = {
  profiles: {
    admin: {
      policies: [{ roleId: "admin" }],
      rateLimit: 0,
    },
    anonymous: {
      policies: [{ roleId: "anonymous" }],
    },
    default: {
      policies: [{ roleId: "default" }],
    },
  },
  roles: {
    admin: {
      controllers: {
        "*": {
          actions: {
            "*": true,
          },
        },
      },
    },
    anonymous: {
      controllers: {
        "*": {
          actions: {
            "*": true,
          },
        },
      },
    },
    default: {
      controllers: {
        "*": {
          actions: {
            "*": true,
          },
        },
      },
    },
  },
};

const dataModelVersion = "2.0.0";

class InternalIndexHandler extends Store {
  constructor() {
    super(
      global.kuzzle.config.services.storageEngine.internalIndex.name,
      storeScopeEnum.PRIVATE,
    );

    this.timeout =
      global.kuzzle.config.services.internalIndex.bootstrapLockTimeout;
    this.config = global.kuzzle.config.services.storageEngine.internalIndex;

    // IDs for config documents
    this._BOOTSTRAP_DONE_ID = `${this.index}.done`;
    this._DATAMODEL_VERSION_ID = "internalIndex.dataModelVersion";
    this._JWT_SECRET_ID = "security.jwt.secret";

    this.logger = global.kuzzle.log.child("internalIndexHandler");
  }

  /**
   * @returns {Promise}
   */
  async init() {
    await super.init(this.config.collections);

    const mutex = new Mutex("InternalIndexBootstrap", {
      timeout: -1,
      ttl: 30000,
    });

    await mutex.lock();

    try {
      const bootstrapped = await this.exists("config", this._BOOTSTRAP_DONE_ID);

      if (bootstrapped) {
        await this._initSecret();
        return;
      }

      await Bluebird.resolve(this._bootstrapSequence()).timeout(this.timeout);

      await this.create(
        "config",
        { timestamp: Date.now() },
        {
          id: this._BOOTSTRAP_DONE_ID,
        },
      );
    } catch (error) {
      if (error instanceof Bluebird.TimeoutError) {
        throw kerror.get(
          "services",
          "storage",
          "bootstrap_timeout",
          "internalIndex",
        );
      }

      throw error;
    } finally {
      await mutex.unlock();
    }
  }

  /**
   * @override
   */
  async _bootstrapSequence() {
    debug("Bootstrapping security structure");
    await this.createInitialSecurities();

    debug("Bootstrapping document validation structure");
    await this.createInitialValidations();

    debug("Bootstrapping JWT secret");
    await this._initSecret();

    // Create datamodel version
    await this.create(
      "config",
      { version: dataModelVersion },
      {
        id: this._DATAMODEL_VERSION_ID,
      },
    );
  }

  /**
   * Creates initial roles and profiles as specified in Kuzzle configuration
   */
  async createInitialSecurities() {
    await Bluebird.map(
      Object.entries(securitiesBootstrap.roles),
      ([roleId, content]) => {
        return this.createOrReplace("roles", roleId, content, {
          refresh: "wait_for",
        });
      },
    );

    await Bluebird.map(
      Object.entries(securitiesBootstrap.profiles),
      ([profileId, content]) => {
        return this.createOrReplace("profiles", profileId, content, {
          refresh: "wait_for",
        });
      },
    );
  }

  async createInitialValidations() {
    const initialValidations = global.kuzzle.config.validation;
    const promises = [];

    for (const [index, collection] of Object.entries(initialValidations)) {
      for (const [collectionName, validation] of Object.entries(collection)) {
        const validationId = `${index}#${collectionName}`;

        promises.push(
          this.createOrReplace("validations", validationId, validation),
        );
      }
    }

    await Bluebird.all(promises);
  }

  async _initSecret() {
    const { authToken, jwt } = global.kuzzle.config.security;
    const configSeed = authToken?.secret ?? jwt?.secret;

    let storedSeed = await this.exists("config", this._JWT_SECRET_ID);

    if (!configSeed) {
      if (!storedSeed) {
        storedSeed = crypto.randomBytes(512).toString("hex");
        await this.create(
          "config",
          { seed: storedSeed },
          { id: this._JWT_SECRET_ID },
        );
      }

      this.logger.warn(
        "[!] Kuzzle is using a generated seed for authentication. This is suitable for development but should NEVER be used in production. See https://docs.kuzzle.io/core/2/guides/getting-started/deploy-your-application/",
      );
    }
    global.kuzzle.secret = configSeed
      ? configSeed
      : (await this.get("config", this._JWT_SECRET_ID))._source.seed;
  }
}

module.exports = InternalIndexHandler;
