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

const kerror = require("../../kerror");
const { isPlainObject } = require("../../util/safeObject");
const { NativeController } = require("./baseController");

/**
 * @class CollectionController
 */
class CollectionController extends NativeController {
  constructor() {
    super([
      "create",
      "delete",
      "deleteSpecifications",
      "exists",
      "getMapping",
      "getSettings",
      "getSpecifications",
      "list",
      "refresh",
      "scrollSpecifications",
      "searchSpecifications",
      "truncate",
      "update",
      "updateMapping",
      "updateSpecifications",
      "validateSpecifications",
    ]);

    this.defaultScrollTTL =
      global.kuzzle.config.services.storageEngine.defaults.scrollTTL;
  }

  /**
   * Updates the mapping of the collection
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async updateMapping(request) {
    request.addDeprecation(
      "2.1.0",
      'This action has been deprecated since Kuzzle version 2.1.0. This feature might be removed in a future major version. To update a collection, use this API action instead: "collection:update".',
    );

    const { index, collection } = request.getIndexAndCollection();
    const mappings = request.getBody();

    const updated = await this.ask(
      "core:storage:public:mappings:update",
      index,
      collection,
      mappings,
    );

    return this._filterMappingResponse(updated);
  }

  /**
   * Get the collection mapping
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async getMapping(request) {
    const { index, collection } = request.getIndexAndCollection(),
      includeKuzzleMeta = request.getBoolean("includeKuzzleMeta");

    const mapping = await this.ask(
      "core:storage:public:mappings:get",
      index,
      collection,
      { includeKuzzleMeta },
    );

    return this._filterMappingResponse(mapping);
  }

  /**
   * Get the collection settings
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async getSettings(request) {
    const { index, collection } = request.getIndexAndCollection();

    return this.ask(
      "core:storage:public:collection:settings:get",
      index,
      collection,
      {},
    );
  }

  /**
   * Get the collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getSpecifications(request) {
    const { index, collection } = request.getIndexAndCollection();

    return global.kuzzle.internalIndex
      .get("validations", `${index}#${collection}`)
      .then((response) => response._source)
      .catch((error) => {
        if (error.status === 404) {
          throw kerror.getFrom(
            error,
            "validation",
            "assert",
            "not_found",
            index,
            collection,
          );
        }

        throw error;
      });
  }

  /**
   * Search for collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async searchSpecifications(request) {
    const { from, size, scrollTTL, searchBody } = request.getSearchParams();

    if (!isPlainObject(searchBody)) {
      throw kerror.get("api", "assert", "invalid_type", "body.query", "object");
    }

    this.assertNotExceedMaxFetch(size - from);

    const { hits, scrollId, total } = await global.kuzzle.internalIndex.search(
      "validations",
      searchBody,
      { from, scroll: scrollTTL, size },
    );

    return { hits, scrollId, total };
  }

  /**
   * Scroll over a paginated search results
   *
   * @param {Request} request
   * @returns {Promise.<object>}
   */
  async scrollSpecifications(request) {
    const ttl = request.getString("scroll", this.defaultScrollTTL),
      id = request.getString("scrollId");

    return global.kuzzle.internalIndex
      .scroll(id, ttl)
      .then(({ scrollId, hits, total }) => ({
        hits,
        scrollId,
        total,
      }));
  }

  /**
   * Replace the specifications of a collection
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async updateSpecifications(request) {
    const { index, collection } = request.getIndexAndCollection();
    const specifications = request.getBody();

    const { isValid, errors } = await global.kuzzle.validation.validateFormat(
      index,
      collection,
      specifications,
      true,
    );

    if (!isValid) {
      throw kerror.get(
        "validation",
        "assert",
        "invalid_specifications",
        errors.join("\n\t- "),
      );
    }

    await global.kuzzle.internalIndex.createOrReplace(
      "validations",
      `${index}#${collection}`,
      {
        collection,
        index,
        validation: specifications,
      },
    );

    await global.kuzzle.internalIndex.refreshCollection("validations");
    await global.kuzzle.validation.curateSpecification();

    return specifications;
  }

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async deleteSpecifications(request) {
    const { index, collection } = request.getIndexAndCollection();
    const specificationsId = `${index}#${collection}`;

    try {
      await global.kuzzle.internalIndex.delete("validations", specificationsId);
    } catch (error) {
      if (error.status === 404) {
        return {
          acknowledged: true,
        };
      }

      throw error;
    }

    await global.kuzzle.internalIndex.refreshCollection("validations");
    await global.kuzzle.validation.curateSpecification();

    return {
      acknowledged: true,
    };
  }

  /**
   * Validate a specification
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateSpecifications(request) {
    const { index, collection } = request.getIndexAndCollection(),
      specifications = request.getBody();

    return global.kuzzle.validation
      .validateFormat(index, collection, specifications, true)
      .then(({ isValid, errors }) => {
        if (!isValid) {
          return {
            description: "Some errors with provided specifications.",
            details: errors,
            valid: false,
          };
        }

        return {
          valid: true,
        };
      });
  }

  /**
   * Reset a collection by removing all documents while keeping the existing mapping
   *
   * @param {KuzzleRequest} request
   * @returns {Promise.<Object>}
   */
  async truncate(request) {
    const { index, collection } = request.getIndexAndCollection();

    await this.ask(
      "core:storage:public:collection:truncate",
      index,
      collection,
    );

    return {
      acknowledged: true,
    };
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async list(request) {
    const index = request.getIndex();
    const from = request.getInteger("from", 0);
    const size = request.getInteger("size", 0);
    const type = request.getString("type", "all");

    if (!["all", "stored", "realtime"].includes(type)) {
      throw kerror.get(
        "api",
        "assert",
        "invalid_argument",
        '"all", "stored", "realtime"',
      );
    }

    if (request.input.args.type) {
      request.addDeprecation(
        "2.10.2",
        'The "type" argument and this route returning a list of realtime collections have both been deprecated since Kuzzle version 2.10.1. This feature might be removed in a future major version. To get a list of realtime collections, use this API action instead: "realtime:list".',
      );
    }

    let collections = [];

    if (type === "realtime" || type === "all") {
      const list = await this.ask("core:realtime:collections:get", index);
      collections = list.map((name) => ({ name, type: "realtime" }));
    }

    if (type !== "realtime") {
      const publicCollections = await this.ask(
        "core:storage:public:collection:list",
        index,
      );

      collections = collections.concat(
        publicCollections.map((name) => ({ name, type: "stored" })),
      );
    }

    collections.sort((a, b) => {
      if (a.name === b.name) {
        return 0;
      }
      return a.name < b.name ? -1 : 1;
    });

    return this._paginateCollections(from, size, { collections, type });
  }

  /**
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  exists(request) {
    const { index, collection } = request.getIndexAndCollection();

    return this.ask("core:storage:public:collection:exist", index, collection);
  }

  /**
   * Creates a new collection with the specifed mappings and settings.
   * Only update the mappings and settings if the collection exists.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async create(request) {
    const body = request.getBody({});
    const { index, collection } = request.getIndexAndCollection();

    let config = {};

    // @deprecated sending directly the mappings is deprecated since 2.1.0
    if (body.properties || body.dynamic || body._meta) {
      config.mappings = body;
      request.addDeprecation(
        "2.1.0",
        'Using "properties", "dynamic" or "_meta" fields in the body has been deprecated since Kuzzle version 2.1.0. This feature might be removed in a future major version. Use "settings" and "mappings" fields instead',
      );
    } else {
      config = body;
    }

    await this.ask(
      "core:storage:public:collection:create",
      index,
      collection,
      config,
    );

    return { acknowledged: true };
  }

  /**
   * Updates a collection mappings and settings.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async update(request) {
    const config = request.getBody({}),
      { index, collection } = request.getIndexAndCollection();

    await this.ask(
      "core:storage:public:collection:update",
      index,
      collection,
      config,
    );

    return null;
  }

  /**
   * Refresh a collection
   *
   * @param {Request} request
   * @returns {Promise.<null>}
   */
  async refresh(request) {
    const { index, collection } = request.getIndexAndCollection();

    await this.ask("core:storage:public:collection:refresh", index, collection);

    return null;
  }

  /**
   * Deletes a collection
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {Promise.<null>}
   */
  async delete(request) {
    const { index, collection } = request.getIndexAndCollection();

    await this.ask("core:storage:public:collection:delete", index, collection);

    return null;
  }

  /**
   * Uses from and size to paginate response results
   * If type is "all", stored collections are prioritary
   *
   * @param {Number} from
   * @param {Number} size
   * @param {Object} response
   * @returns {Object} { collections, from, size }
   */
  _paginateCollections(from, size, response) {
    if (from || size) {
      if (from) {
        response.from = Number.parseInt(from);
      } else {
        response.from = 0;
      }

      if (size) {
        response.size = Number.parseInt(size);

        response.collections = response.collections.slice(
          response.from,
          response.from + response.size,
        );
      } else {
        response.collections = response.collections.slice(response.from);
      }
    }

    return response;
  }

  /**
   * Return only the mapping properties we want to output in our API
   * @param  {Object} mapping - raw ES mapping
   * @returns {Object}
   */
  _filterMappingResponse(mapping) {
    return {
      _meta: mapping._meta,
      dynamic: mapping.dynamic,
      properties: mapping.properties,
    };
  }
}

module.exports = CollectionController;
