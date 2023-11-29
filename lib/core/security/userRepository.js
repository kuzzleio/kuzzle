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

const { Request } = require("../../api/request");
const debug = require("../../util/debug")("kuzzle:core:security:users");
const { Repository } = require("../shared/repository");
const kerror = require("../../kerror");
const { User } = require("../../model/security/user");
const ApiKey = require("../../model/storage/apiKey");

/**
 * @class UserRepository
 * @extends Repository
 */
class UserRepository extends Repository {
  /**
   * @param {SecurityModule} securityModule
   * @constructor
   */
  constructor(securityModule) {
    super({ store: global.kuzzle.internalIndex });
    this.module = securityModule;
    this.collection = "users";
    this.ObjectConstructor = User;
    this.anonymousUser = null;
  }

  async init() {
    this.anonymousUser = await this.fromDTO({
      _id: "-1",
      name: "Anonymous",
      profileIds: ["anonymous"],
    });

    /**
     * Gets the standard anonymous User object
     * @returns {User}
     */
    global.kuzzle.onAsk(
      "core:security:user:anonymous:get",
      () => this.anonymousUser,
    );

    /**
     * Creates a new user
     * @param  {String} id - user identifier
     * @param  {Array.<String>} profileIds - associated profile identifiers
     * @param  {Object} content - optional user content
     * @param  {Object} opts - refresh, userId (used for metadata)
     * @returns {User}
     * @throws If already exists or if at least one profile ID is unknown
     */
    global.kuzzle.onAsk(
      "core:security:user:create",
      (id, profileIds, content, opts) =>
        this.create(id, profileIds, content, opts),
    );

    /**
     * Deletes an existing user
     * @param  {String} id
     * @param  {Object} opts - refresh
     * @throws If the user doesn't exist
     */
    global.kuzzle.onAsk("core:security:user:delete", (id, opts) =>
      this.deleteById(id, opts),
    );

    /**
     * Loads and returns an existing user
     * @param  {String} id - user identifier
     * @returns {User}
     * @throws {NotFoundError} If the user doesn't exist
     */
    global.kuzzle.onAsk("core:security:user:get", (id) => this.load(id));

    /**
     * Gets multiple users
     * @param  {Array.<String>} ids
     * @returns {Array.<User>}
     * @throws If one or more users don't exist
     */
    global.kuzzle.onAsk("core:security:user:mGet", (ids) =>
      this.loadMultiFromDatabase(ids),
    );

    /**
     * Replaces the user's content
     * @param  {String} id - user identifier
     * @param  {Object} content
     * @param  {Object} opts - refresh, userId (used for metadata)
     * @returns {User} Updated user
     */
    global.kuzzle.onAsk(
      "core:security:user:replace",
      (id, profileIds, content, opts) =>
        this.replace(id, profileIds, content, opts),
    );

    /**
     * Fetches the next page of search results
     * @param  {String} id - scroll identifier
     * @param  {String} [ttl] - refresh the scroll results TTL
     * @returns {Object} Search results
     */
    global.kuzzle.onAsk("core:security:user:scroll", (id, ttl) =>
      this.scroll(id, ttl),
    );

    /**
     * Searches users
     * @param  {Object} searchBody - Search body (ES format)
     * @param  {Object} opts (from, size, scroll)
     * @returns {Object} Search results
     */
    global.kuzzle.onAsk("core:security:user:search", (searchBody, opts) =>
      this.search(searchBody, opts),
    );

    /**
     * Removes all existing users
     * @param  {Object} opts (refresh)
     */
    global.kuzzle.onAsk("core:security:user:truncate", (opts) =>
      this.truncate(opts),
    );

    /**
     * Updates an existing user using a partial content
     * @param  {String} id - user identifier to update
     * @param  {Object} content - partial content to apply
     * @param  {Object} opts - refresh, retryOnConflict, userId (used for metadata)
     * @returns {User} Updated user
     */
    global.kuzzle.onAsk(
      "core:security:user:update",
      (id, profileIds, content, opts) =>
        this.update(id, profileIds, content, opts),
    );

    /**
     * Returns true if there is at least one user with the "admin" profile
     *
     * @returns {Boolean}
     */
    global.kuzzle.onAsk("core:security:user:admin:exist", () =>
      this.adminExists(),
    );
  }

  /**
   * Creates a user
   * @param {String} id
   * @param {Array} profileIds - profiles to associate to this user
   * @param {Object} content
   * @param {Object} [opts]
   */
  async create(id, profileIds, content, { userId, refresh = "false" } = {}) {
    const user = await this.fromDTO({
      ...content,
      // Profile Ids and content are stored at the same level... for now.
      profileIds,
      // Always last, in case content contains these keys
      /* eslint-disable-next-line sort-keys */
      _id: id,
      _kuzzle_info: {
        author: userId,
        createdAt: Date.now(),
        updatedAt: null,
        updater: null,
      },
    });

    try {
      return await this.persist(user, {
        database: { method: "create", refresh },
      });
    } catch (error) {
      if (error.id === "services.storage.document_already_exists") {
        throw kerror.get("security", "user", "already_exists", id);
      }

      throw error;
    }
  }

  /**
   * Updates a user's content
   * @param  {String} id
   * @param  {Array}  profileIds
   * @param  {Object} content
   * @param  {Object} [opts]
   * @returns {Promise}
   */
  async update(
    id,
    profileIds,
    content,
    { refresh = "false", retryOnConflict = 10, userId } = {},
  ) {
    const user = await this.load(id);
    const pojo = this.toDTO(user);

    const updated = await this.fromDTO({
      // /!\ order is important
      ...pojo,
      ...content,
      // Always last, in case content contains these keys
      _id: id,
      _kuzzle_info: {
        ...pojo._kuzzle_info,
        updatedAt: Date.now(),
        updater: userId,
      },
      profileIds: profileIds || pojo.profileIds,
    });

    return this.persist(updated, {
      database: {
        method: "update",
        refresh,
        retryOnConflict,
      },
    });
  }

  /**
   * Replaces a user's content
   * @param  {String} id
   * @param  {Object} content
   * @param  {Object} [opts]
   * @returns {Promise}
   */
  async replace(id, profileIds, content, { refresh = "false", userId } = {}) {
    // Assertion: the user must exist
    await this.load(id);

    const user = await this.fromDTO({
      ...content,
      // Always last, in case content contains these keys
      _id: id,
      _kuzzle_info: {
        author: userId,
        createdAt: Date.now(),
        updatedAt: null,
        updater: null,
      },
      profileIds,
    });

    return this.persist(user, {
      database: {
        method: "replace",
        refresh,
      },
    });
  }

  /**
   * Loads a user
   *
   * @param {string} id
   * @returns {Promise.<User>}
   * @throws {NotFoundError} If the user is not found
   */
  async load(id) {
    if (id === "anonymous" || id === "-1") {
      return this.anonymousUser;
    }

    return super.load(id);
  }

  async persist(user, options = {}) {
    const databaseOptions = options.database || {};
    const cacheOptions = options.cache || {};

    if (
      user._id === this.anonymousUser._id &&
      user.profileIds.indexOf("anonymous") === -1
    ) {
      throw kerror.get("security", "user", "anonymous_profile_required");
    }

    await this.persistToDatabase(user, databaseOptions);

    await this.persistToCache(user, cacheOptions);

    return user;
  }

  /**
   * @param dto
   * @returns {Promise<User>}
   */
  async fromDTO(dto) {
    if (dto.profileIds && !Array.isArray(dto.profileIds)) {
      dto.profileIds = [dto.profileIds];
    }

    const user = await super.fromDTO(dto);

    if (user._id === undefined || user._id === null) {
      return this.anonymousUser;
    }

    // if the user exists (has an _id) but no profile associated: there is a
    // database inconsistency
    if (user.profileIds.length === 0) {
      throw kerror.get("security", "user", "no_profile", user._id);
    }

    const profiles = await this.module.profile.loadProfiles(user.profileIds);

    // Fail if not all profiles are found
    if (profiles.some((p) => p === null)) {
      throw kerror.get("security", "user", "cannot_hydrate", dto._id);
    }

    return user;
  }

  /**
   * Deletes a user from memory and database, along with its related tokens and
   * strategies.
   *
   * @param {String} id
   * @param {Object} [options]
   * @returns {Promise}
   */
  async deleteById(id, opts) {
    const user = await this.load(id);

    return this.delete(user, opts);
  }

  /**
   * @override
   */
  async delete(user, { refresh = "false" } = {}) {
    debug("Delete user: %s", user);

    await this._removeUserStrategies(user);
    await ApiKey.deleteByUser(user, { refresh });
    await this.module.token.deleteByKuid(user._id);
    await super.delete(user, { refresh });
  }

  async _removeUserStrategies(user) {
    const availableStrategies = global.kuzzle.pluginsManager.listStrategies();
    const userStrategies = [];
    const request = new Request({ _id: user._id });

    for (const strategy of availableStrategies) {
      const existStrategy = global.kuzzle.pluginsManager.getStrategyMethod(
        strategy,
        "exists",
      );

      if (await existStrategy(request, user._id, strategy)) {
        userStrategies.push(strategy);
      }
    }

    const errors = [];
    if (userStrategies.length > 0) {
      for (const strategy of userStrategies) {
        const deleteStrategy = global.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          "delete",
        );

        // We catch any error produced by delete as we want to make as much
        // cleanup as possible
        try {
          debug(
            "Deleting credentials on strategy %s for user %s",
            strategy,
            user._id,
          );
          await deleteStrategy(request, user._id, strategy);
        } catch (error) {
          errors.push(error);
        }
      }
    }

    if (errors.length > 0) {
      throw kerror.get(
        "security",
        "credentials",
        "rejected",
        errors.join("\n\t- "),
      );
    }
  }

  /**
   * @override
   */
  async loadOneFromDatabase(id) {
    try {
      return await super.loadOneFromDatabase(id);
    } catch (err) {
      if (err.status === 404) {
        throw kerror.get("security", "user", "not_found", id);
      }
      throw err;
    }
  }

  async adminExists() {
    const { total } = await this.search(
      {
        query: {
          term: { profileIds: "admin" },
        },
      },
      { size: 1 },
    );

    return total >= 1;
  }
}

module.exports = UserRepository;
