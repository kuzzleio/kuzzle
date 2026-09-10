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

import { JSONObject } from "kuzzle-sdk";

import * as actionEnum from "../../core/realtime/actionEnum";
import * as kerror from "../../kerror";
import { dumpCollectionDocuments } from "../../util/dump-collection";
import {
  assertHasBody,
  assertHasIndexAndCollection,
} from "../../util/requestAssertions";
import { KuzzleRequest } from "../request";
import { NativeController } from "./baseController";
import extractFields = require("../../util/extractFields");

/** One of `actionEnum`'s values — what a document notification reports. */
type NotifyAction = (typeof actionEnum)[keyof typeof actionEnum];

/** The two single-document writes `_writeDocument` serves. */
type WriteMethod = "replace" | "createOrReplace";

/** The two multi-document reads `_mFetch` serves. */
type FetchMethod = "mGet" | "mExists";

/** The five multi-document writes `_mChanges` serves. */
type ChangeMethod =
  | "mCreate"
  | "mCreateOrReplace"
  | "mUpdate"
  | "mUpsert"
  | "mReplace";

/**
 * @description actions available on the document Controller (used by generic events)
 * @key actions
 * @value event type (empty for actions that are not linked to events)
 */
const actions = {
  count: "",
  create: "write",
  createOrReplace: "write",
  delete: "delete",
  deleteByQuery: "delete",
  deleteFields: "update",
  exists: "get",
  export: "get",
  get: "get",
  mCreate: "write",
  mCreateOrReplace: "write",
  mDelete: "delete",
  mExists: "get",
  mGet: "get",
  mReplace: "write",
  mUpdate: "update",
  mUpsert: "update",
  replace: "write",
  scroll: "",
  search: "get",
  update: "update",
  updateByQuery: "update",
  upsert: "update",
  validate: "",
};

/**
 * @class DocumentController
 */
class DocumentController extends NativeController {
  constructor() {
    super(Object.keys(actions));
  }

  /**
   * @returns {Record<string, unknown>}
   */
  static get actions() {
    return actions;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async search(request: KuzzleRequest) {
    const { from, size, scrollTTL, searchBody } = request.getSearchParams();
    const index = request.getIndex({ required: false });
    const collection = request.getCollection({ required: false });
    const targets = request.getArray("targets", []);
    const lang = request.getLangParam();

    if (!index && !collection && (!targets || targets.length === 0)) {
      throw kerror.get(
        "api",
        "assert",
        "missing_argument",
        "index, collection or targets",
      );
    }

    if (
      index &&
      collection &&
      (hasMultiTargets(index) || hasMultiTargets(collection))
    ) {
      throw kerror.get(
        "services",
        "storage",
        "invalid_multi_index_collection_usage",
      );
    }

    if (targets.length > 0) {
      // Index and Collections from a target should not contains any characters for multi targetting or _all
      // Otherwise it might be possible to bypass some checks and access data that should be accessed
      // We should also verify that each target has an index and collections specified before further processing
      this.assertTargetsAreValid(targets);
    }

    this.assertNotExceedMaxFetch(size - from);

    if (lang === "koncorde") {
      searchBody.query = await this.translateKoncorde(searchBody.query || {});
    }

    let result;
    if (targets.length > 0) {
      result = await this.ask(
        "core:storage:public:document:multiSearch",
        targets,
        searchBody,
        { from, scroll: scrollTTL, size },
      );
    } else {
      if (!index) {
        throw kerror.get("api", "assert", "missing_argument", "index");
      }

      if (!collection) {
        throw kerror.get("api", "assert", "missing_argument", "collection");
      }

      result = await this.ask(
        "core:storage:public:document:search",
        index,
        collection,
        searchBody,
        { from, scroll: scrollTTL, size },
      );
    }

    return {
      aggregations: result.aggregations,
      hits: result.hits,
      remaining: result.remaining,
      scrollId: result.scrollId,
      suggest: result.suggest,
      total: result.total,
    };
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async scroll(request: KuzzleRequest) {
    const scrollTTL = request.getScrollTTLParam();
    const _scrollId = request.getString("scrollId");

    const result = await this.ask(
      "core:storage:public:document:scroll",
      _scrollId,
      { scrollTTL },
    );

    return {
      hits: result.hits,
      remaining: result.remaining,
      scrollId: result.scrollId,
      total: result.total,
    };
  }

  /**
   * @param {Request} request
   * @returns {Promise<Boolean>}
   */
  exists(request: KuzzleRequest) {
    const id = request.getId();
    const { index, collection } = request.getIndexAndCollection();

    return this.ask(
      "core:storage:public:document:exist",
      index,
      collection,
      id,
    );
  }

  /**
   * @param {Request} request
   */
  mExists(request: KuzzleRequest) {
    return this._mFetch(request, "mExists");
  }

  async export(request: KuzzleRequest) {
    const { index, collection } = request.getIndexAndCollection();
    const { size, scrollTTL } = request.getSearchParams();
    const lang = request.getLangParam();
    const format = request.getString("format", "jsonl");
    const separator = request.getString("separator", ",");
    const query = request.getObjectFromBodyOrArgs("query", {});
    const sort = request.getObjectFromBodyOrArgs("sort", {});
    const collapse = request.getObjectFromBodyOrArgs("collapse", {});
    const fields = request.getArrayFromBodyOrArgs("fields", []) as string[];
    const fieldsName = request.getObjectFromBodyOrArgs("fieldsName", {});

    const searchBody: JSONObject = { query };

    if (Object.keys(collapse).length > 0) {
      searchBody.collapse = collapse;
    }

    if (request.context.connection.protocol !== "http") {
      throw kerror.get(
        "api",
        "assert",
        "unsupported_protocol",
        request.context.connection.protocol,
        "document:export",
      );
    }

    if (lang === "koncorde") {
      searchBody.query = await this.translateKoncorde(searchBody.query || {});
    }

    if (Object.keys(sort).length > 0) {
      searchBody.sort = sort;
    }
    let mimeType = "html/text";

    if (format.toLowerCase() === "csv") {
      mimeType = "text/csv";
    }

    request.response.configure({
      headers: {
        "Content-Disposition": `attachment; filename="${index}-${collection}.${format}"`,
        "Content-Type": mimeType,
      },
    });

    return dumpCollectionDocuments(
      index,
      collection,
      searchBody,
      format,
      fields,
      {
        fieldsName,
        lang,
        scroll: scrollTTL || "5s",
        separator,
        size,
      },
    );
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async get(request: KuzzleRequest) {
    const id = request.getId();
    const { index, collection } = request.getIndexAndCollection();

    const result = await this.ask(
      "core:storage:public:document:get",
      index,
      collection,
      id,
    );

    return {
      _id: result._id,
      _source: result._source,
      _version: result._version,
    };
  }

  /**
   * Get specific documents according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mGet(request: KuzzleRequest) {
    // @todo next major release: if (successes.length === 0) then throw (no matter strict value)
    return this._mFetch(request, "mGet");
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async count(request: KuzzleRequest) {
    const { searchBody } = request.getSearchParams();
    const { index, collection } = request.getIndexAndCollection();
    const lang = request.getLangParam();
    if (lang === "koncorde") {
      searchBody.query = await this.translateKoncorde(searchBody.query);
    }
    const count = await this.ask(
      "core:storage:public:document:count",
      index,
      collection,
      searchBody,
    );

    return { count };
  }

  /**
   * Create a new document
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Object>}
   */
  async create(request: KuzzleRequest) {
    const id = request.getId({ ifMissing: "ignore" });
    const userId = request.getKuid();
    const refresh = request.getRefresh();
    const silent = request.getBoolean("silent");
    const { index, collection } = request.getIndexAndCollection();

    const validated = await global.kuzzle.validation.validate(request, false);

    // Add metadata
    const pipeMetadataResult = await this.pipe(
      "generic:document:injectMetadata",
      {
        metadata: {
          author: userId,
          createdAt: Date.now(),
          updatedAt: null,
          updater: null,
        },
        request,
      },
    );

    const created = await this.ask(
      "core:storage:public:document:create",
      index,
      collection,
      {
        ...validated.getBody(),
        _kuzzle_info: pipeMetadataResult.metadata,
      },
      {
        id,
        injectKuzzleMeta: false,
        refresh,
        userId,
      },
    );

    if (!silent) {
      await this.ask(
        "core:realtime:document:notify",
        validated,
        actionEnum.CREATE,
        created,
      );
    }

    return created;
  }

  /**
   * Create the documents provided in the body
   * Delegates the notification to create action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreate(request: KuzzleRequest) {
    return this._mChanges(request, "mCreate", actionEnum.CREATE);
  }

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createOrReplace(request: KuzzleRequest) {
    return this._writeDocument(request, "createOrReplace");
  }

  /**
   * Create or replace the documents provided in the body
   * Delegates the notification to createOrReplace action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mCreateOrReplace(request: KuzzleRequest) {
    return this._mChanges(request, "mCreateOrReplace", actionEnum.WRITE);
  }

  /**
   * Update a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async update(request: KuzzleRequest) {
    const id = request.getId();
    const content = request.getBody();
    const userId = request.getKuid();
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const retryOnConflict = request.input.args.retryOnConflict;
    const source = request.getBoolean("source");
    const { index, collection } = request.getIndexAndCollection();

    const modifiedRequest = await global.kuzzle.validation.validate(
      request,
      false,
    );

    // Add metadata
    const pipeMetadataResult = await this.pipe(
      "generic:document:injectMetadata",
      {
        metadata: {
          updatedAt: Date.now(),
          updater: userId,
        },
        request,
      },
    );

    const updatedDocument = await this.ask(
      "core:storage:public:document:update",
      index,
      collection,
      id,
      {
        ...content,
        _kuzzle_info: pipeMetadataResult.metadata,
      },
      {
        injectKuzzleMeta: false,
        refresh,
        retryOnConflict,
        userId,
      },
    );

    const _updatedFields = extractFields(content, {
      fieldsToIgnore: ["_kuzzle_info"],
    });

    if (!silent) {
      await this.ask(
        "core:realtime:document:notify",
        modifiedRequest,
        actionEnum.UPDATE,
        {
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          _updatedFields,
        },
      );
    }

    if (source) {
      return updatedDocument;
    }
    return {
      _id: updatedDocument._id,
      _source: {
        ...content,
        _kuzzle_info: updatedDocument._source._kuzzle_info,
      },
      _version: updatedDocument._version,
    };
  }

  /**
   * Applies a partial update to an existing document.
   * If the document doesn't already exist, a new document is created.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async upsert(request: KuzzleRequest) {
    const id = request.getId();
    const content = request.getBodyObject("changes");
    const defaultValues = request.getBodyObject("default", {});
    const userId = request.getKuid();
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const retryOnConflict = request.input.args.retryOnConflict;
    const source = request.getBoolean("source");
    const { index, collection } = request.getIndexAndCollection();

    // Add metadata
    const pipeMetadataResult = await this.pipe(
      "generic:document:injectMetadata",
      {
        defaultMetadata: {
          author: userId,
          createdAt: Date.now(),
        },
        metadata: {
          updatedAt: Date.now(),
          updater: userId,
        },
        request,
      },
    );

    const updatedDocument = await this.ask(
      "core:storage:public:document:upsert",
      index,
      collection,
      id,
      {
        ...content,
        _kuzzle_info: pipeMetadataResult.metadata,
      },
      {
        defaultValues: {
          ...defaultValues,
          _kuzzle_info: pipeMetadataResult.defaultMetadata,
        },
        injectKuzzleMeta: false,
        refresh,
        retryOnConflict,
        userId,
      },
    );

    if (!silent && updatedDocument.created) {
      await this.ask(
        "core:realtime:document:notify",
        request,
        actionEnum.CREATE,
        updatedDocument._source,
      );
    } else if (!silent) {
      const _updatedFields = extractFields(content, {
        fieldsToIgnore: ["_kuzzle_info"],
      });

      await this.ask(
        "core:realtime:document:notify",
        request,
        actionEnum.UPDATE,
        {
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          _updatedFields,
        },
      );
    }

    if (source) {
      return updatedDocument;
    }

    return {
      _id: updatedDocument._id,
      _version: updatedDocument._version,
      created: updatedDocument.created,
    };
  }

  /**
   * Update the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mUpdate(request: KuzzleRequest) {
    return this._mChanges(request, "mUpdate", actionEnum.UPDATE);
  }

  /**
   * Applies a partial update to documents provided in the body.
   * If some of the documents don't already exist, they will be created.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mUpsert(request: KuzzleRequest) {
    return this._mChanges(request, "mUpsert", actionEnum.UPSERT);
  }

  /**
   * Replace a document through the persistent layer. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  replace(request: KuzzleRequest) {
    return this._writeDocument(request, "replace");
  }

  /**
   * Replace the documents provided in the body
   * Delegates the notification to update action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mReplace(request: KuzzleRequest) {
    return this._mChanges(request, "mReplace", actionEnum.REPLACE);
  }

  /**
   * Delete a document through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async delete(request: KuzzleRequest) {
    const id = request.getId();
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const source = request.getBoolean("source");
    const { index, collection } = request.getIndexAndCollection();

    const document = await this.ask(
      "core:storage:public:document:get",
      index,
      collection,
      id,
    );

    await this.ask(
      "core:storage:public:document:delete",
      index,
      collection,
      id,
      {
        refresh,
      },
    );

    if (!silent) {
      await this.ask(
        "core:realtime:document:notify",
        request,
        actionEnum.DELETE,
        document,
      );
    }

    return source ? document : { _id: document._id };
  }

  /**
   * Delete specific documents according to given ids
   * Delegates the notification to delete action
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mDelete(request: KuzzleRequest) {
    const ids = request.getBodyArray("ids");
    const strict = request.getBoolean("strict");
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const { index, collection } = request.getIndexAndCollection();

    const { documents, errors } = await this.ask(
      "core:storage:public:document:mDelete",
      index,
      collection,
      ids,
      { refresh },
    );

    if (strict && errors.length) {
      throw kerror.get(
        "api",
        "process",
        "incomplete_multiple_request",
        "delete",
        errors,
      );
    }

    // @todo next major release: if (successes.length === 0) then throw (no matter strict value)

    if (!silent) {
      await this.ask(
        "core:realtime:document:mNotify",
        request,
        actionEnum.DELETE,
        documents,
      );
    }

    return {
      errors,
      successes: documents.map((d) => d._id),
    };
  }

  /**
   * Delete several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteByQuery(request: KuzzleRequest) {
    let query = request.getBodyObject("query", {});
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const source = request.getBoolean("source");
    const { index, collection } = request.getIndexAndCollection();
    const lang = request.getLangParam();

    if (lang === "koncorde") {
      query = await this.translateKoncorde(query);
    }

    const result = await this.ask(
      "core:storage:public:document:deleteByQuery",
      index,
      collection,
      query,
      { refresh },
    );

    if (!silent) {
      await this.ask(
        "core:realtime:document:mNotify",
        request,
        actionEnum.DELETE,
        result.documents,
      );
    }

    if (!source) {
      result.documents.forEach((d) => (d._source = undefined));
    }
    return {
      documents: result.documents,
      ids: result.documents.map((d) => d._id),
    };
  }

  /**
   * Delete fields of a document. Throws an error if the document doesn't exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteFields(request: KuzzleRequest) {
    const id = request.getId();
    const fields = request.getBodyArray("fields");
    const userId = request.getKuid();
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const source = request.getBoolean("source");
    const { index, collection } = request.getIndexAndCollection();

    const response = await this.ask(
      "core:storage:public:document:deleteFields",
      index,
      collection,
      id,
      fields,
      { refresh, userId },
    );

    if (!silent) {
      await this.ask(
        "core:realtime:document:notify",
        request,
        actionEnum.UPDATE,
        {
          _id: response._id,
          _source: response._source,
        },
      );
    }

    if (source) {
      return response;
    }

    return {
      _id: response._id,
      _version: response._version,
    };
  }

  /**
   * Update several documents matching a query through the persistent layer
   *
   * @param {Request} request
   * @returns {Promise<Object}
   */
  async updateByQuery(request: KuzzleRequest) {
    let query = request.getBodyObject("query");
    const changes = request.getBodyObject("changes");
    const silent = request.getBoolean("silent");
    const userId = request.getKuid();
    const refresh = request.getString("refresh", "false");
    const source = request.getBoolean("source");
    const { index, collection } = request.getIndexAndCollection();
    const lang = request.getLangParam();

    if (lang === "koncorde") {
      query = await this.translateKoncorde(query);
    }
    delete changes._kuzzle_info;
    const result = await this.ask(
      "core:storage:public:document:updateByQuery",
      index,
      collection,
      query,
      changes,
      { refresh, userId },
    );

    if (!silent) {
      await this.ask(
        "core:realtime:document:mNotify",
        request,
        actionEnum.UPDATE,
        result.successes.map((doc) => ({
          _id: doc._id,
          _source: doc._source,
          _updatedFields: extractFields(changes, {
            fieldsToIgnore: ["_kuzzle_info"],
          }),
        })),
      );
    }

    if (!source) {
      result.successes.forEach((d) => (d._source = undefined));
    }

    return result;
  }

  /**
   * Validate a document against collection validation specifications.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validate(request: KuzzleRequest) {
    assertHasBody(request);
    assertHasIndexAndCollection(request);

    // @todo validation service should not take request argument
    return global.kuzzle.validation.validate(request, true);
  }

  /**
   * Fetches documents by id (`mGet`) or checks their existence (`mExists`):
   * the two actions take the same input and shape the same response, they only
   * read through a different storage event.
   *
   * @param  {Request} request
   * @param  {String} methodName storage method to ask for
   * @returns {Promise.<Object>} { successes, errors }
   */
  async _mFetch(request: KuzzleRequest, methodName: FetchMethod) {
    // `ids` may come either in the body or in the query string
    const ids =
      request.input.body?.ids && Object.keys(request.input.body.ids).length
        ? request.getBodyArray("ids")
        : request.getArray("ids");
    const { index, collection } = request.getIndexAndCollection();
    const strict = request.getBoolean("strict");

    this.assertNotExceedMaxFetch(ids.length);

    const { items, errors } = await this.ask(
      `core:storage:public:document:${methodName}`,
      index,
      collection,
      ids,
    );

    if (strict && errors.length) {
      throw kerror.get(
        "api",
        "process",
        "incomplete_multiple_request",
        "get",
        errors,
      );
    }

    return {
      errors,
      successes: items,
    };
  }

  /**
   * Writes a single document, either through `replace` (which requires it to
   * exist) or `createOrReplace` (which does not). Both validate, inject
   * metadata, write and then notify; they differ only in the storage event,
   * the notification action, and what that notification carries.
   *
   * @param  {Request} request
   * @param  {String} methodName storage method to ask for — it also decides
   *                  the notification action and its payload, so the two can
   *                  no longer disagree (TD-31)
   * @returns {Promise.<Object>} the storage response
   */
  async _writeDocument(request: KuzzleRequest, methodName: WriteMethod) {
    const action: NotifyAction =
      methodName === "replace" ? actionEnum.REPLACE : actionEnum.WRITE;

    const id = request.getId();
    const content = request.getBody();
    const userId = request.getKuid();
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const { index, collection } = request.getIndexAndCollection();

    const modifiedRequest = await global.kuzzle.validation.validate(
      request,
      false,
    );

    // Add metadata
    const pipeMetadataResult = await this.pipe(
      "generic:document:injectMetadata",
      {
        metadata: {
          author: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updater: userId,
        },
        request,
      },
    );

    const response = await this.ask(
      `core:storage:public:document:${methodName}`,
      index,
      collection,
      id,
      {
        ...content,
        _kuzzle_info: pipeMetadataResult.metadata,
      },
      {
        injectKuzzleMeta: false,
        refresh,
        userId,
      },
    );

    if (!silent) {
      // `replace` notifies the request's own payload rather than the storage
      // response — kept as-is, the two actions have always differed here.
      await this.ask(
        "core:realtime:document:notify",
        modifiedRequest,
        action,
        methodName === "replace"
          ? {
              _id: modifiedRequest.input.args._id,
              _source: modifiedRequest.input.body,
            }
          : response,
      );
    }

    return response;
  }

  /**
   * Applies a multi-document change request (create, update,
   * replace, createOrReplace, upsert)
   *
   * @param  {Request} request
   * @param  {String} methodName ES Service method to apply
   * @param  {notifyActionEnum} action performed on the documents
   * @returns {Promise.<Object>} { successes, errors }
   */
  async _mChanges(
    request: KuzzleRequest,
    methodName: ChangeMethod,
    action: NotifyAction,
  ) {
    let source = true;
    const userId = request.getKuid();
    const strict = request.getBoolean("strict");
    const silent = request.getBoolean("silent");
    const refresh = request.getString("refresh", "false");
    const documents = request.getBodyArray("documents");
    const { index, collection } = request.getIndexAndCollection();
    const retryOnConflict =
      action === actionEnum.UPDATE || action === actionEnum.UPSERT
        ? request.getInteger("retryOnConflict", 0)
        : undefined;

    this.assertNotExceedMaxWrite(documents.length);

    if (request.input.args.source !== undefined) {
      source =
        request.input.args.source === "false"
          ? false
          : request.getBoolean("source");
    }

    if (documents.length === 0) {
      return {
        errors: [],
        successes: [],
      };
    }

    for (const [i, document] of documents.entries()) {
      if (document._source) {
        throw kerror.get(
          "api",
          "assert",
          "unexpected_argument",
          `documents[${i}]._source`,
          `documents[${i}].body`,
        );
      }
      if (document.body?._kuzzle_info !== undefined) {
        delete document.body._kuzzle_info;
      }
    }

    const response = await this.ask(
      `core:storage:public:document:${methodName}`,
      index,
      collection,
      documents,
      { refresh, retryOnConflict, source, userId },
    );

    if (strict && response.errors.length) {
      throw kerror.get(
        "api",
        "process",
        "incomplete_multiple_request",
        methodName,
        response.errors,
      );
    }

    // @todo next major release: if (successes.length === 0) then throw (no matter strict value)

    if (
      !silent &&
      (action === actionEnum.UPDATE || action === actionEnum.UPSERT)
    ) {
      const documentsDictionnary = documents.reduce((result, document) => {
        result[document._id] =
          action === actionEnum.UPSERT ? document.changes : document.body;
        return result;
      }, {});

      await this.ask(
        "core:realtime:document:mNotify",
        request,
        action,
        response.items.map((item) => {
          if (!item.created) {
            item._updatedFields = extractFields(
              documentsDictionnary[item._id],
              { fieldsToIgnore: ["_kuzzle_info"] },
            );
          }
          return item;
        }),
      );
    } else if (!silent) {
      await this.ask(
        "core:realtime:document:mNotify",
        request,
        action,
        response.items,
      );
    }

    return {
      errors: response.errors,
      successes: response.items,
    };
  }
}

function hasMultiTargets(str: string) {
  return [",", "*", "+"].some((chr) => str.includes(chr)) || str === "_all";
}

export = DocumentController;
