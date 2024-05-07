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

const kuzzleStateEnum = require("../../kuzzle/kuzzleStateEnum");
const { Role } = require("../../model/security/role");
const { ObjectRepository } = require("../shared/ObjectRepository");
const kerror = require("../../kerror");
const didYouMean = require("../../util/didYouMean");
const { cacheDbEnum } = require("../cache/cacheDbEnum");

const roleRightsError = kerror.wrap("security", "role");

/**
 * @class RoleRepository
 * @extends ObjectRepository
 */
class RoleRepository extends ObjectRepository {
  /**
   * @constructor
   * @param {SecurityModule} securityModule
   */
  constructor(securityModule) {
    super({
      cache: cacheDbEnum.NONE,
      store: global.kuzzle.internalIndex,
    });

    this.module = securityModule;

    this.collection = "roles";
    this.ObjectConstructor = Role;
    this.roles = new Map();
  }

  init() {
    /**
     * Creates a new role
     * @param  {String} id - role identifier / name
     * @param  {Object} content
     * @param  {Object} opts - force, refresh, userId (used for metadata)
     * @returns {Role}
     * @throws If already exists or if the content is invalid
     */
    global.kuzzle.onAsk("core:security:role:create", (id, content, opts) =>
      this.create(id, content, opts),
    );

    /**
     * Creates a new role, or replaces it if it already exists
     * @param  {String} id
     * @param  {Object} content
     * @param  {Object} opts - force, refresh, userId (used for metadata)
     * @returns {Role}
     * @throws If the content is invalid
     */
    global.kuzzle.onAsk(
      "core:security:role:createOrReplace",
      (id, content, opts) => this.createOrReplace(id, content, opts),
    );

    /**
     * Deletes an existing role
     * @param  {String} id
     * @param  {Object} opts - refresh
     * @throws If the role doesn't exist, if it is protected, or if it's
     *         still in use
     */
    global.kuzzle.onAsk("core:security:role:delete", (id, opts) =>
      this.deleteById(id, opts),
    );

    /**
     * Loads and returns an existing role
     * @param  {String} id - role identifier
     * @returns {Role}
     * @throws {NotFoundError} If the role doesn't exist
     */
    global.kuzzle.onAsk("core:security:role:get", (id) => this.load(id));

    /**
     * Invalidates the RAM cache from the given role ID. If none is provided,
     * the entire cache is emptied.
     *
     * @param  {String} [id] - role identifier
     */
    global.kuzzle.onAsk("core:security:role:invalidate", (id) =>
      this.invalidate(id),
    );

    /**
     * Gets multiple roles
     * @param  {Array} ids
     * @returns {Array.<Role>}
     * @throws If one or more roles don't exist
     */
    global.kuzzle.onAsk("core:security:role:mGet", (ids) =>
      this.loadRoles(ids),
    );

    /**
     * Searches roles associated to a provided list of API controllers
     * @param  {Array.<String>} controllers
     * @param  {Number} from
     * @param  {Number} size
     * @returns {Object} Search results
     */
    global.kuzzle.onAsk("core:security:role:search", (controllers, opts) =>
      this.searchRole(controllers, opts),
    );

    /**
     * Removes all existing roles and invalidates the RAM cache
     * @param  {Object} opts (refresh)
     */
    global.kuzzle.onAsk("core:security:role:truncate", (opts) =>
      this.truncate(opts),
    );

    /**
     * Updates an existing profile using a partial content
     * @param  {String} id - profile identifier to update
     * @param  {Object} content - partial content to apply
     * @param  {Object} opts - force, refresh, retryOnConflict,
     *                         userId (used for metadata)
     * @returns {Role} Updated role
     */
    global.kuzzle.onAsk("core:security:role:update", (id, content, opts) =>
      this.update(id, content, opts),
    );

    /**
     * Verifies that existing roles are sane
     */
    global.kuzzle.onAsk("core:security:verify", () => this.sanityCheck());
  }

  /**
   * From a list of role ids, retrieves the matching Role objects.
   *
   * @param {Array} ids The role ids to load
   * @param {Object} options - resetCache (false)
   * @returns {Promise.<Array.<Role>>}
   */
  loadRoles(ids) {
    const roles = [];

    for (const id of ids) {
      let role = this.roles.get(id);

      if (!role) {
        role = this.loadOneFromDatabase(id).then((r) => {
          this.roles.set(id, r);
          return r;
        });

        this.roles.set(id, role);
      }

      roles.push(role);
    }

    return Bluebird.all(roles);
  }

  /**
   * Creates a new role, or create/replace a role
   *
   * @param {String} id
   * @param {Object} content
   * @param {Object} [opts]
   * @returns {Role}
   */
  async _createOrReplace(
    id,
    content,
    { force = false, method, refresh = "false", userId = null } = {},
  ) {
    const dto = {
      ...content,
      // Always last, in case content contains these keys
      _id: id,
      _kuzzle_info: {
        author: userId,
        createdAt: Date.now(),
        updatedAt: null,
        updater: null,
      },
    };

    const role = await this.fromDTO(dto);

    return this.validateAndSaveRole(role, { force, method, refresh });
  }

  /**
   * Creates a new role
   *
   * @param {String} id
   * @param {Object} content
   * @param {Object} [opts]
   * @returns {Role}
   */
  async create(id, content, opts) {
    return this._createOrReplace(id, content, {
      method: "create",
      ...opts,
    });
  }

  /**
   * Creates or replaces a role
   *
   * @param {String} id
   * @param {Object} content
   * @param {Object} [opts]
   * @returns {Role}
   */
  async createOrReplace(id, content, opts) {
    return this._createOrReplace(id, content, {
      method: "createOrReplace",
      ...opts,
    });
  }

  /**
   * Updates a role (replaces the entire content)
   *
   * @todo  (breaking change) make this function able to handle partial updates
   *        instead of replacing the entire role content (hint: _.merge)
   *
   * @param  {String} id
   * @param  {Object} content
   * @param  {Object} [opts]
   * @returns {Promise}
   */
  async update(id, content, { force, refresh, retryOnConflict, userId } = {}) {
    const updated = await this.fromDTO({
      // /!\ order is important
      ...content,
      // Always last, in case content contains these keys
      _id: id,
      _kuzzle_info: {
        updatedAt: Date.now(),
        updater: userId,
      },
    });

    return this.validateAndSaveRole(updated, {
      force,
      method: "replace",
      refresh,
      retryOnConflict,
    });
  }

  /**
   * Get from database the document that represent the role given in parameter
   *
   * @param {string} id
   * @returns {Promise.<Role>} role
   * @throws {NotFoundError} If the corresponding role doesn't exist
   */
  async load(id) {
    if (this.roles.has(id)) {
      return this.roles.get(id);
    }

    const role = await this.loadOneFromDatabase(id);

    await this.roles.set(role._id, role);

    return role;
  }

  /**
   * @override
   */
  async loadOneFromDatabase(id) {
    try {
      return await super.loadOneFromDatabase(id);
    } catch (err) {
      if (err.status === 404) {
        throw kerror.get("security", "role", "not_found", id);
      }
      throw err;
    }
  }

  /**
   * @param {Object} body Search body containing either "query" or "controllers"
   * @param {Object} options
   */
  async searchRole(body, { from = 0, size = 9999 } = {}) {
    if (!body.controllers) {
      return this.search(body, { from, size });
    }

    const searchResults = await this.search(
      { query: {}, sort: [{ _id: { order: "asc" } }] },
      { from: 0, size: 9999 },
    ); // /!\ NOT the options values

    const result = {
      hits: searchResults.hits,
      total: searchResults.total,
    };

    if (body.controllers.length > 0) {
      result.hits = searchResults.hits.filter((role) =>
        Object.keys(role.controllers).some(
          (key) => key === "*" || body.controllers.includes(key),
        ),
      );

      result.total = result.hits.length;
    }

    result.hits = result.hits.slice(from, from + size);

    return result;
  }

  /**
   * Given a Role object, validates its definition and if OK, persist it to the database.
   *
   * @param {Role} role
   * @param {object} [options] The persistence options
   * @returns Promise
   */
  async validateAndSaveRole(role, options = {}) {
    await role.validateDefinition();

    if (role._id === "anonymous" && !role.canLogIn()) {
      throw kerror.get("security", "role", "login_required");
    }

    this.checkRoleNativeRights(role);
    this.checkRolePluginsRights(role, options);
    await this.persistToDatabase(role, options);

    const updatedRole = await this.loadOneFromDatabase(role._id);
    await this.roles.set(role._id, updatedRole);

    return updatedRole;
  }

  /**
   * Given a Role object, checks if its controllers and actions exist.
   *
   * @param {Role} role
   */
  checkRoleNativeRights(role) {
    Object.keys(role.controllers).forEach((roleController) => {
      if (
        roleController !== "*" &&
        !global.kuzzle.funnel.isNativeController(roleController)
      ) {
        return;
      }

      if (roleController === "*") {
        Object.keys(role.controllers["*"].actions).forEach((action) => {
          if (action !== "*") {
            throw roleRightsError.get("unknown_action", role._id, action, "*");
          }
        });
      } else {
        const controller = global.kuzzle.funnel.controllers.get(roleController);
        const actions = Object.keys(role.controllers[roleController].actions);

        actions.forEach((action) => {
          if (action !== "*" && !controller._isAction(action)) {
            throw roleRightsError.get(
              "unknown_action",
              role._id,
              action,
              roleController,
              didYouMean(action, controller.__actions),
            );
          }
        });
      }
    });
  }

  /**
   * Given a Role object, checks if its controllers and actions exist in plugins.
   *
   * @param {Role} role
   * @param {Force} force
   */
  checkRolePluginsRights(role, { force = false, forceWarn = false } = {}) {
    const plugins = global.kuzzle.pluginsManager;

    for (const roleController of Object.keys(role.controllers)) {
      if (
        roleController === "*" ||
        global.kuzzle.funnel.isNativeController(roleController)
      ) {
        return;
      }

      if (!plugins.isController(roleController)) {
        if (!force) {
          throw roleRightsError.get(
            "unknown_controller",
            role._id,
            roleController,
            didYouMean(roleController, plugins.getControllerNames()),
          );
        }

        // Do not print any warning if Kuzzle is not started or if warn is not forced.
        // We need this to load rights without displaying warning at startup
        // because plugins controllers are loaded after default roles
        // then we need to display non-existing controllers with the sanity check
        // made after plugins controllers loading.
        if (global.kuzzle.state === kuzzleStateEnum.RUNNING || forceWarn) {
          global.kuzzle.log.warn(
            `The role "${role._id}" gives access to the non-existing controller "${roleController}".`,
          );
        }

        return;
      }

      const roleActions = Object.keys(role.controllers[roleController].actions);
      for (const action of roleActions) {
        if (action !== "*" && !plugins.isAction(roleController, action)) {
          if (!force) {
            throw roleRightsError.get(
              "unknown_action",
              role._id,
              action,
              roleController,
              didYouMean(action, plugins.getActions(roleController)),
            );
          }

          // see the other comment
          if (global.kuzzle.state === kuzzleStateEnum.RUNNING || forceWarn) {
            global.kuzzle.log.warn(
              `The role "${role._id}" gives access to the non-existing action "${action}" for the controller "${roleController}".`,
            );
          }
        }
      }
    }
  }

  /**
   * Fetching roles and check for each of them for invalid plugin rights.
   * If there are some, Kuzzle will log a warning.
   */

  async sanityCheck() {
    const roles = await this.search({}, {});

    for (const role of roles.hits) {
      this.checkRolePluginsRights(role, { force: true, forceWarn: true });
    }
  }

  /**
   * Deletes a role
   *
   * @param {String} id
   * @param {object} [options]
   * @returns Promise
   */
  async deleteById(id, options) {
    const role = await this.load(id);
    return this.delete(role, options);
  }

  /**
   * @override
   */
  async delete(role, { refresh = "false" } = {}) {
    if (["admin", "default", "anonymous"].indexOf(role._id) > -1) {
      throw kerror.get("security", "role", "cannot_delete");
    }

    const query = { term: { "policies.roleId": role._id } };

    const response = await this.module.profile.search(
      { query },
      {
        from: 0,
        size: 1,
      },
    );

    if (response.total > 0) {
      throw kerror.get("security", "role", "in_use", role._id);
    }

    await this.deleteFromDatabase(role._id, { refresh });

    this.roles.delete(role._id);
  }

  /**
   * From a Role object, returns an object ready to be persisted
   *
   * @param {Role} role
   * @returns {object}
   */
  serializeToDatabase(role) {
    const serializedRole = {};

    Object.keys(role).forEach((key) => {
      if (key !== "_id" && key !== "restrictedTo") {
        serializedRole[key] = role[key];
      }
    });

    return serializedRole;
  }

  /**
   * @override
   */
  async truncate(opts) {
    try {
      await super.truncate(opts);
    } finally {
      this.invalidate();
    }
  }

  /**
   * Invalidate the cache entries for the given role. If none is provided,
   * the entire cache is emptied.
   * @param {string} [roleId]
   */
  invalidate(roleId) {
    if (!roleId) {
      this.roles.clear();
    } else {
      this.roles.delete(roleId);
    }
  }
}

module.exports = RoleRepository;
