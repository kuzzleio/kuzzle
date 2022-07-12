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

const { NativeController } = require("./baseController");
const actionEnum = require("../../core/realtime/actionEnum");
const kerror = require("../../kerror");

/**
 * @class BulkController
 */
class BulkController extends NativeController {
  constructor() {
    super(["import", "write", "mWrite", "deleteByQuery", "updateByQuery"]);
  }

  /**
   * Perform a bulk import
   *
   * @param {Request} request
   * @returns {Promise}
   */
  async import(request) {
    const userId = request.getKuid();
    const { index, collection } = request.getIndexAndCollection();
    const strict = request.getBoolean("strict");
    const refresh = request.getRefresh();
    const bulkData = request.getBodyArray("bulkData");
    const options = {
      refresh,
      userId,
    };

    const { items, errors } = await this.ask(
      "core:storage:public:document:bulk",
      index,
      collection,
      bulkData,
      options
    );

    if (strict && errors.length) {
      throw kerror.get(
        "api",
        "process",
        "incomplete_multiple_request",
        "import",
        errors
      );
    }

    // @todo next major release: if (successes.length === 0) then throw (no matter strict value)

    return {
      errors,
      successes: items,
    };
  }

  /**
   * Write a document without adding metadata or performing data validation.
   */
  async write(request) {
    const { index, collection } = request.getIndexAndCollection();
    const id = request.getId({ ifMissing: "ignore" });
    const content = request.getBody();
    const refresh = request.getRefresh();
    const notify = request.getBoolean("notify");

    const result = await this.ask(
      "core:storage:public:document:createOrReplace",
      index,
      collection,
      id,
      content,
      { injectKuzzleMeta: false, refresh }
    );

    if (notify) {
      await this.ask(
        "core:realtime:document:notify",
        request,
        actionEnum.WRITE,
        result
      );
    }

    return {
      _id: result._id,
      _source: result._source,
      _version: result._version,
    };
  }

  /**
   * Write several documents without adding metadata or performing data validation.
   */
  async mWrite(request) {
    const { index, collection } = request.getIndexAndCollection();
    const documents = request.getBodyArray("documents");
    const strict = request.getBoolean("strict");
    const refresh = request.getRefresh();
    const notify = request.getBoolean("notify");

    const { items, errors } = await this.ask(
      "core:storage:public:document:mCreateOrReplace",
      index,
      collection,
      documents,
      { injectKuzzleMeta: false, limits: false, refresh }
    );

    if (strict && errors.length) {
      throw kerror.get(
        "api",
        "process",
        "incomplete_multiple_request",
        "write",
        errors
      );
    }

    // @todo next major release: if (successes.length === 0) then throw (no matter strict value)

    if (notify) {
      await global.kuzzle.ask(
        "core:realtime:document:mNotify",
        request,
        actionEnum.WRITE,
        items
      );
    }

    const successes = items.map((item) => ({
      _id: item._id,
      _source: item._source,
      _version: item._version,
    }));

    return {
      errors,
      successes,
    };
  }

  /**
   * Directly deletes every documents matching the search query without:
   *  - applying max documents write limit
   *  - fetching deleted documents
   *  - triggering realtime notifications
   */
  async deleteByQuery(request) {
    const { index, collection } = request.getIndexAndCollection();
    const query = request.getBodyObject("query");
    const refresh = request.getRefresh();

    const { deleted } = await this.ask(
      "core:storage:public:document:deleteByQuery",
      index,
      collection,
      query,
      { fetch: false, refresh, size: -1 }
    );

    return { deleted };
  }

  /**
   * Directly update every document matching the search query without:
   *  - Applying max documents write limit
   *  - Injecting Kuzzle metadata
   *  - Triggering realtime notifications
   */
  async updateByQuery(request) {
    const { index, collection } = request.getIndexAndCollection();
    const query = request.getBodyObject("query");
    const changes = request.getBodyObject("changes");
    const refresh = request.getRefresh();

    return this.ask(
      "core:storage:public:bulk:updateByQuery",
      index,
      collection,
      query,
      changes,
      { refresh }
    );
  }
}

module.exports = BulkController;
